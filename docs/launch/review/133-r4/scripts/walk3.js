// WT2 r2 part 2: the signed-in Free user after onboarding. usage: node walk2.js 390x844 mixed
const L = require("./lib");
const fs = require("fs");
const { chromium } = require("playwright");
const S = "/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/wt2r2-scripts";
(async () => {
  const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
  const mode = process.argv[3] || "mixed";
  const P = `${w}-${mode}-c`;
  const email = fs.readFileSync(`${S}/email-${w}-${mode}.txt`, "utf8");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, baseURL: L.BASE,
    storageState: `${S}/state-${w}-${mode}.json`, extraHTTPHeaders: { "x-e2e-device": `wt2r2b-${mode}-${w}-${Date.now()}` } });
  await ctx.addInitScript(() => {
    window.__cls = 0; window.__shifts = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((s) => (s.node && s.node.nodeName ? s.node.nodeName + "." + String(s.node.className || "").slice(0, 40) + " '" + String(s.node.textContent || "").slice(0, 40) + "'" : "?") + ` ${s.previousRect.y}->${s.currentRect.y} h${s.previousRect.height}->${s.currentRect.height}`) }); } }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await ctx.newPage();
  const log = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(`[console.${m.type()}] ${page.url()} :: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => log.push(`[pageerror] ${page.url()} :: ${String(e).slice(0, 300)}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/")) log.push(`[http ${r.status()}] ${r.request().method()} ${r.url()}`); });
  const say = (s) => console.log(s);
  const step = async (name, full = false) => { const f = await L.shot(page, P, name, full); await L.audit(page, name); say(`   shot ${f}`); };
  const small = async () => (await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, [role="button"], input[type="checkbox"], select, summary')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden") continue;
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const inline = cs.display === "inline" && el.parentElement && /^(P|SPAN|LI|LABEL)$/.test(el.parentElement.tagName) && (el.parentElement.textContent || "").trim().length > (el.textContent || "").trim().length + 3;
      if ((r.width < 44 || r.height < 44) && !inline && !el.closest("footer")) out.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  }));
  try {
    // second check: another card
    await page.goto("/?view=flags", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const check2 = page.locator("article[data-row]").nth(1).locator('a[href^="/check?"]');
    const href2 = await check2.getAttribute("href");
    await check2.click();
    await page.waitForURL(/\/check/);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await step("check-2-limit");
    say("CHECK2 " + href2 + ": " + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 1500));
    // reopen first
    await page.goto(process.env.HREF1, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await step("check-1-reopen");
    say("CHECK1-REOPEN: " + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 800));
    // Settings via More
    await page.goto("/", { waitUntil: "networkidle" });
    const more = page.getByRole("button", { name: "More", exact: true }).or(page.getByRole("link", { name: "More", exact: true })).first();
    if (w < 800 && await more.count()) { await more.click(); await page.waitForTimeout(600); await step("more-menu"); say("MORE: " + (await page.locator('[role="dialog"], nav[aria-label]').last().innerText().catch(() => "")).replace(/\n+/g, " | ")); say("small in More: " + JSON.stringify(await small())); }
    const set = page.getByRole("link", { name: "Settings" }).first();
    if (await set.count() && await set.isVisible()) await set.click(); else { say("no visible Settings link; going by URL"); await page.goto("/settings"); }
    await page.waitForURL(/\/settings/);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await step("settings");
    await step("settings-full", true);
    say("SETTINGS: " + (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 2500));
    // pricing
    await page.goto("/pricing", { waitUntil: "networkidle" });
    await step("pricing");
    // Account: sign-in clause, then sign out
    await page.goto("/account", { waitUntil: "networkidle" });
    say("CLAUSE(first session): " + ((await page.locator("main").innerText()).match(/Signed in as[^\n]*/) || [""])[0]);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForTimeout(2500);
    say("after sign out url " + page.url());
    await step("signed-out");
    // Log in with password
    await page.goto("/login", { waitUntil: "networkidle" });
    await step("login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
    const box = page.getByRole("checkbox");
    if (await box.count()) await box.check();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    say("after login url " + page.url());
    await step("after-login");
    say("AFTER LOGIN: " + (await L.text(page, 800)).replace(/\n+/g, " | "));
    await page.goto("/account", { waitUntil: "networkidle" });
    say("CLAUSE(password): " + ((await page.locator("main").innerText()).match(/Signed in as[^\n]*/) || [""])[0]);
    await step("account-after-login");
  } catch (e) {
    say("ERROR " + e.message.split("\n")[0]);
    await L.shot(page, P, "error");
  } finally {
    say("--- LOG\n" + log.join("\n"));
    await browser.close();
  }
})();
