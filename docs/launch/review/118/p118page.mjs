// #118 reviewer probe: signup page fold/H1/CLS/plans
import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const [port, out] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const svc = { authorization: "Bearer e2e-service", apikey: "e2e-anon", "content-type": "application/json" };
const subs = async () => (await (await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions`, { headers: svc })).json());
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const init = () => { window.__cls = 0; window.__s = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__s.push(e.value.toFixed(4) + " " + (e.sources || []).map((s) => (s.node?.getAttribute?.("data-testid") || s.node?.tagName) + ` y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`).join(",")); } }).observe({ type: "layout-shift", buffered: true }); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function signIn(page, plan, email) {
  const before = new Set((await subs()).map((r) => r.user_id));
  try { await page.goto(base + "/login"); } catch { await page.goto(base + "/login"); }
  for (let i = 0; i < 30; i++) { try { await page.getByRole("tab", { name: "Email link" }).click({ timeout: 2000 }); await page.getByRole("button", { name: "Email me a sign-in link" }).waitFor({ timeout: 2000 }); break; } catch {} }
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  const { url } = await (await fetch(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await page.waitForURL((u) => !/login|auth|callback/.test(u.pathname), { timeout: 90000 });
  await page.waitForLoadState("networkidle");
  if (!/onboarding/.test(page.url())) return;
  let mine; for (let i = 0; i < 40 && !mine; i++) { mine = (await subs()).find((r) => !before.has(r.user_id)); if (!mine) await page.waitForTimeout(500); }
  if (!mine) { const me = await (await page.request.get(base + "/api/me")).json(); mine = { user_id: me.user.id }; }
  if (plan !== "free") await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${mine.user_id}`, { method: "PATCH", headers: svc, body: JSON.stringify({ comp_tier: plan, comp_expires_at: null }) });
  await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 60000 });
  await page.waitForURL((u) => u.pathname !== "/onboarding", { timeout: 60000 });
  await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Skip tour" }); if (await skip.isVisible().catch(() => false)) await skip.click();
}
const fs = await import("fs"); const log = (s) => { console.log(s); fs.appendFileSync(`${out}/p118-page.log`, s + "\n"); };
const fx = JSON.parse(fs.readFileSync(process.env.WT + "/apps/web/test-results/paid-fixtures/flags.json", "utf8")).flags;
const byLen = [...fx].sort((a, b) => b.question.length - a.question.length);
const IDS = [byLen[0], byLen[5], byLen[20], byLen.at(-1)];
const initX = () => { window.__cls = 0; window.__all = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls += e.value; window.__all.push(`${e.value.toFixed(4)}@${Math.round(e.startTime)} ${(e.sources || []).slice(0, 2).map((s) => `${s.node?.getAttribute?.("data-testid") ?? s.node?.nodeName} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`).join(",")}`); } }).observe({ type: "layout-shift", buffered: true }); };
const meas = (p, w) => p.evaluate((w) => { const l = document.querySelector("[data-testid=signup-bet]"); const btn = [...document.querySelectorAll('[role=tabpanel] button')].find((x) => /create account|sign up/i.test(x.textContent.trim())); const nav = [...document.querySelectorAll('nav[aria-label="Main"]')].find((n) => n.getBoundingClientRect().height > 0 && getComputedStyle(n).position === "fixed"); const hdr = document.querySelector("header"); const h1 = document.querySelector("main h1"); const lh = l ? parseFloat(getComputedStyle(l).lineHeight) : 1;
  return { line: l?.innerText.trim(), lines: l ? Math.round(l.getBoundingClientRect().height / lh) : null, clipped: l ? l.scrollHeight > l.clientHeight + 1 : null, btn: btn?.textContent.trim(), btnBottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null, limit: Math.round(w < 768 && nav ? nav.getBoundingClientRect().top : innerHeight), hdrBottom: Math.round(hdr.getBoundingClientRect().bottom), h1Top: Math.round(h1.getBoundingClientRect().top), h1: h1.innerText, cls: +window.__cls.toFixed(4), shifts: window.__all, cents: /\d\s?¢|\bcents?\b/i.test(document.body.innerText), disc: (document.querySelector("footer")?.innerText ?? "").includes("Market analytics, not financial advice. Based on past results. 18+."), hscroll: document.documentElement.scrollWidth > innerWidth }; }, w);
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [1440, 900]]) for (const m of IDS) for (const slowFont of [false, true]) {
  if (slowFont && m !== IDS[0]) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); await ctx.addInitScript(initX); const p = await ctx.newPage();
  if (slowFont) await p.route(/\.woff2?(\?|$)/, async (r) => { await new Promise((x) => setTimeout(x, 2500)); await r.continue(); });
  await p.goto(`${base}/signup?next=${encodeURIComponent(`/m/${m.id}`)}`); await p.getByTestId("signup-bet").waitFor({ timeout: 90000 }); await p.waitForLoadState("networkidle"); await p.waitForTimeout(slowFont ? 4500 : 3000);
  const r = await meas(p, w); log(`${w}x${h} ${slowFont ? "SLOW FONTS " : ""}(${m.question.length} ch) ${JSON.stringify(r)}`);
  if (m === IDS[0] && !slowFont) await p.screenshot({ path: `${out}/signup-${w}x${h}.png` });
  await ctx.close();
}
// plans: Free signed in on /signup?next= and /m; all plans disclaimer/no cents at 390/1440
for (const plan of ["free", "pro", "premium"]) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p0 = await c.newPage(); await signIn(p0, plan, `p118-${plan}-${Date.now()}@example.com`); const state = await c.storageState(); await c.close();
  for (const w of [390, 1440]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, hasTouch: w < 768, isMobile: w < 768, storageState: state }); await ctx.addInitScript(initX); const p = await ctx.newPage();
    await p.goto(`${base}/signup?next=${encodeURIComponent(`/m/${IDS[0].id}`)}`); await p.waitForLoadState("networkidle"); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ url: location.pathname, bet: !!document.querySelector("[data-testid=signup-bet]"), cls: +window.__cls.toFixed(4), cents: /\d\s?¢|\bcents?\b/i.test(document.body.innerText), disc: (document.querySelector("footer")?.innerText ?? "").includes("Market analytics, not financial advice. Based on past results. 18+."), hscroll: document.documentElement.scrollWidth > innerWidth }));
    log(`${plan} ${w} /signup?next=/m/${IDS[0].id}: ${JSON.stringify(r)}`);
    await ctx.close();
  }
}
await b.close();
