import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test"); const fs = await import("fs");
const [port, out] = process.argv.slice(2); const base = `http://localhost:${port}`; fs.mkdirSync(out, { recursive: true });
const svc = { authorization: "Bearer e2e-service", apikey: "e2e-anon", "content-type": "application/json" };
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const init = () => { window.__cls = 0; window.__s = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__s.push(e.value.toFixed(4) + " " + (e.sources || []).map((s) => (s.node?.getAttribute?.("data-testid") || s.node?.tagName) + ` y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`).join(",")); } }).observe({ type: "layout-shift", buffered: true }); };
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(out + "/p98.log", s + "\n"); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const go = async (p, u) => { try { await p.goto(base + u); } catch { await p.waitForTimeout(3000); await p.goto(base + u); } };
async function signUp(p, email, plan) {
  await go(p, "/login");
  for (let i = 0; i < 30; i++) { try { await p.getByRole("tab", { name: "Email link" }).click({ timeout: 2000 }); await p.getByRole("button", { name: "Email me a sign-in link" }).waitFor({ timeout: 2000 }); break; } catch {} }
  await p.getByLabel("Email", { exact: true }).fill(email); await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "Email me a sign-in link" }).click(); await p.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  const { url } = await (await fetch(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await p.goto(url); await p.waitForURL(/onboarding/, { timeout: 90000 });
  if (plan !== "free") { const me = await (await p.request.get(base + "/api/me")).json(); await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { method: "PATCH", headers: svc, body: JSON.stringify({ comp_tier: plan, comp_expires_at: null }) }); }
}
const facts = (p) => p.evaluate((DISC) => {
  const r = (e) => e ? (({ top, bottom, height }) => ({ top: Math.round(top), bottom: Math.round(bottom), h: Math.round(height) }))(e.getBoundingClientRect()) : null;
  const body = document.body.innerText; const lk = document.querySelector('[data-testid="locked-bets"]');
  const sel = document.querySelector('[data-testid="bar-sport"]');
  return { url: location.pathname + location.search, h1: document.querySelector("main h1")?.innerText, h1box: r(document.querySelector("main h1")), cards: document.querySelectorAll("article[data-row]").length,
    barSport: sel ? (sel.value ?? sel.getAttribute("value")) + " / " + (sel.innerText || sel.textContent || "").trim().slice(0, 40) : null, barCount: document.querySelector('[data-testid="bar-count"]')?.innerText,
    pills: [...document.querySelectorAll('a[aria-label^="Remove filter"], button[aria-label^="Remove filter"]')].map((a) => a.getAttribute("aria-label")),
    locked: lk ? { text: lk.innerText.replace(/\n+/g, " | "), ...r(lk) } : null, vh: innerHeight, scrollY: Math.round(scrollY),
    yourTopics: /your topics/i.test(document.querySelector("main")?.innerText || ""), tour: document.querySelector('[role="dialog"][aria-labelledby="tour-h"]')?.innerText.replace(/\n+/g, " | ").slice(0, 160) ?? null,
    disc: body.includes(DISC), cents: /\d\s?¢|\bcents?\b/i.test(body), sideways: document.documentElement.scrollWidth - innerWidth, cls: +window.__cls.toFixed(4), s: window.__s.slice(0, 4) };
}, DISC);
const plans = (process.env.PLANS || "free,pro,premium").split(",");
for (const plan of plans) for (const [w, h] of [[390, 844], [1440, 900]].filter(([w]) => !process.env.SIZES || process.env.SIZES.split(",").includes(String(w)))) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768 }); await c.addInitScript(init); const p = await c.newPage();
  await signUp(p, `p98-${plan}-${w}-${Date.now()}@example.com`, plan);
  const nba = await (await p.request.get(base + "/api/flags?t=sports.nba")).json();
  log(`${plan} ${w}: /api/flags?t=sports.nba total ${nba.total} rows ${nba.rows?.length} free_daily ${nba.free_daily}`);
  // real onboarding: pick NBA only, Next, Next, Show my best bets
  const nbaBtn = p.locator("button[aria-pressed]").filter({ hasText: /^NBA(\d|none|$)/ }); await p.getByText(/open$/).first().waitFor({ timeout: 60000 }); log(`  NBA buttons ${await nbaBtn.count()} url ${p.url()}`);
  await nbaBtn.click(); await p.waitForTimeout(1500); if (await nbaBtn.getAttribute("aria-pressed") !== "true") { log("  retry NBA click"); await nbaBtn.click(); await p.waitForTimeout(1500); } log(`  NBA pressed ${await nbaBtn.getAttribute("aria-pressed")}`);
  p.on("request", (r) => { if (/profile|profiles/.test(r.url()) && r.method() !== "GET") log(`  req ${r.method()} ${r.url().replace(base, "")} ${r.postData()?.slice(0, 200)}`); });
  await p.getByRole("button", { name: "Next", exact: true }).click(); await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByRole("button", { name: "Show my best bets" }).click();
  await p.waitForURL((u) => u.pathname !== "/onboarding", { timeout: 60000 });
  await p.locator("main h1").first().waitFor({ timeout: 60000 }); await p.waitForTimeout(4000);
  const f1 = await facts(p); log(`${plan} ${w} first screen: ${JSON.stringify(f1)}`);
  await p.screenshot({ path: `${out}/${plan}-${w}-first.png` });
  const tour = p.locator('[role="dialog"][aria-labelledby="tour-h"]');
  if (await tour.count()) {
    await p.locator("[role=dialog][aria-labelledby=tour-h]").getByRole("button", { name: "Next", exact: true }).click(); await p.waitForTimeout(1200);
    log(`${plan} ${w} tour step 2: ${JSON.stringify(await tour.innerText().catch(() => null))?.slice(0, 160)} h1box ${JSON.stringify((await facts(p)).h1box)}`);
    await p.screenshot({ path: `${out}/${plan}-${w}-tour2.png` });
    const skip = p.getByRole("button", { name: /Skip tour|Close|Done/ }); if (await skip.count()) await skip.first().click().catch(() => {});
  }
  if (plan === "free") {
    // plain topic filter page load (no fav): NBA (0 today) and a topic with bets outside the sample
    const all = await (await p.request.get(base + "/api/flags")).json(); let emptyT = null;
    for (const t of Object.keys(all.facets?.topics ?? {}).slice(0, 60)) { const r = await (await p.request.get(base + `/api/flags?t=${encodeURIComponent(t)}`)).json(); if (r.total > 0 && r.rows.length === 0) { emptyT = [t, r.total]; break; } }
    for (const t of ["sports.nba", emptyT?.[0]].filter(Boolean)) {
      await p.evaluate(() => { window.__cls = 0; window.__s = []; }); await go(p, `/?view=flags&t=${encodeURIComponent(t)}`); await p.locator("main h1").first().waitFor(); await p.waitForTimeout(3000);
      log(`${plan} ${w} plain t=${t}${t === emptyT?.[0] ? ` (total ${emptyT[1]})` : ""}: ${JSON.stringify(await facts(p))}`); await p.screenshot({ path: `${out}/${plan}-${w}-plain-${t}.png` });
    }
    // reach the empty state by changing filters in the page: all bets → pick the topic in the bar
    if (emptyT) {
      await go(p, "/?view=flags"); await p.locator("article[data-row]").first().waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
      await p.evaluate(() => { window.__cls = 0; window.__s = []; });
      const href = `/?view=flags&t=${encodeURIComponent(emptyT[0])}`;
      await p.evaluate((h) => { const a = document.createElement("a"); a.href = h; document.body.appendChild(a); }, href);
      // use the app's own filter: the Sport or topic field
      const field = p.getByTestId("bar-sport"); const tag = await field.evaluate((n) => n.tagName);
      log(`  bar-sport is <${tag}>`);
      if (tag === "SELECT") { await field.selectOption("t:" + emptyT[0]).catch(async () => { const opts = await field.locator("option").evaluateAll((o) => o.map((x) => x.value)); log("  options", JSON.stringify(opts.slice(0, 20))); }); }
      const apply = p.getByRole("button", { name: /^(Apply|Show|Search)/ }); if (await apply.count()) await apply.first().click().catch(() => {});
      await p.waitForTimeout(3500);
      log(`${plan} ${w} empty via filter change: ${JSON.stringify(await facts(p))}`); await p.screenshot({ path: `${out}/${plan}-${w}-filterchange.png` });
    }
  }
  await c.close();
}
// signed out home
for (const [w, h] of [[390, 844], [1440, 900]].filter(([w]) => !process.env.SIZES || process.env.SIZES.split(",").includes(String(w)))) { const c = await b.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(init); const p = await c.newPage(); await go(p, "/"); await p.waitForTimeout(3000); const f = await facts(p); log(`signed-out ${w}: h1 ${JSON.stringify(f.h1)} cards ${f.cards} disc ${f.disc} cents ${f.cents} sideways ${f.sideways} cls ${f.cls}`); await c.close(); }
await b.close();
