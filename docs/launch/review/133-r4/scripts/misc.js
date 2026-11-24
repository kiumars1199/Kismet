// pre-hydration tiles, leaving onboarding mid-way, More menu at 390, limit card size
const { chromium } = require("playwright");
const L = require("./lib");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, baseURL: L.BASE, extraHTTPHeaders: { "x-e2e-device": "wt2r2-misc-" + Date.now() } });
  const page = await ctx.newPage();
  const log = [];
  page.on("console", (m) => { if (m.type() === "error") log.push(`[console.error] ${page.url()} :: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => log.push(`[pageerror] ${String(e).slice(0, 200)}`));
  const email = `wt2r2-misc-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email));
  await page.waitForURL(/\/onboarding/, { timeout: 60000 });
  await page.waitForLoadState("networkidle");
  // pre-hydration
  await page.goto("about:blank");
  let release; const gate = new Promise((r) => (release = r));
  await page.route("**/_next/static/**/*.js", async (route) => { await gate; await route.continue().catch(() => {}); });
  await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
  const nfl = page.getByRole("button", { name: "NFL", exact: true });
  await nfl.waitFor({ timeout: 30000 });
  const look = await nfl.evaluate((el) => ({ disabled: el.disabled, opacity: getComputedStyle(el).opacity, cursor: getComputedStyle(el).cursor, busy: el.closest('[data-testid="topics-picker"]')?.getAttribute("aria-busy") }));
  console.log("pre-hydration NFL tile:", JSON.stringify(look));
  await page.screenshot({ path: `${L.OUT}/390-misc-01-onboarding-before-hydration.png` });
  release();
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /^NFL/ }).click(); await page.waitForTimeout(500);
  console.log("after hydration NFL pressed:", await page.getByRole("button", { name: /^NFL/ }).getAttribute("aria-pressed"));
  // leave mid-way: tap Best bets tab on step 1
  await page.getByRole("link", { name: "Best bets", exact: true }).first().click();
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  console.log("left onboarding ->", page.url(), "| h1:", (await page.locator("h1").first().innerText()).replace(/\n/g, " "));
  console.log("nudge:", await page.locator('aside[aria-label="Get started"]').innerText().catch(() => "none"));
  await page.screenshot({ path: `${L.OUT}/390-misc-02-left-onboarding.png` });
  // More tab menu
  const more = page.getByRole("button", { name: "More", exact: true }).or(page.getByRole("link", { name: "More", exact: true })).first();
  await more.click(); await page.waitForTimeout(800);
  await page.screenshot({ path: `${L.OUT}/390-misc-03-more-menu.png` });
  console.log("MORE menu:", (await page.locator("body").innerText()).split("\n").filter(Boolean).slice(-40).join(" | "));
  const set = page.getByRole("link", { name: "Settings", exact: true });
  console.log("Settings links visible:", await set.evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })));
  // check limit card size (device check count: this is a new device+account -> do 2 checks)
  for (const m of ["/check?m=6674485&side=0", "/check?m=6673073&side=1"]) { await page.goto(m, { waitUntil: "networkidle" }); await page.waitForTimeout(2000); }
  const card = await page.evaluate(() => { const p = [...document.querySelectorAll("p")].find((e) => /Free includes 1 bet check a day/.test(e.textContent)); let c = p; while (c && !/rounded/.test(c.className)) c = c.parentElement; const r = c.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), c.className.slice(0, 120)]; });
  console.log("limit card top/height/class:", JSON.stringify(card));
  console.log(log.join("\n"));
  await b.close();
})();
