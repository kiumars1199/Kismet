// #117 reviewer probe: home CLS / data-tier per plan
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
const fs = await import("fs"); const log = (s) => { console.log(s); fs.appendFileSync(`${out}/p117-home.log`, s + "\n"); };
const initX = () => { window.__cls = 0; window.__all = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls += e.value; window.__all.push(`${e.value.toFixed(4)}@${Math.round(e.startTime)} ${(e.sources || []).slice(0, 2).map((s) => `${s.node?.getAttribute?.("data-testid") ?? s.node?.nodeName} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`).join(",")}`); } }).observe({ type: "layout-shift", buffered: true });
  document.addEventListener("DOMContentLoaded", () => { const c = document.querySelector("[data-testid=bet-card]"); window.__early = c ? Math.round(c.getBoundingClientRect().height) : null; window.__earlySlots = document.querySelectorAll("[data-testid=log-bet-slot]").length; }); };
const PLANS = (process.env.PLANS || "out,free,pro,premium").split(","); const RUNS = +(process.env.RUNS || 3);
for (const plan of PLANS) {
  let state;
  if (plan !== "out") { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); await signIn(p, plan, `p117-${plan}-${Date.now()}@example.com`); state = await c.storageState(); await c.close(); }
  for (const w of [390, 1440]) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const ctx = await b.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, hasTouch: w < 768, isMobile: w < 768, storageState: state }); await ctx.addInitScript(initX); const p = await ctx.newPage();
      await p.goto(base + "/"); await p.getByTestId("bet-card").first().waitFor({ timeout: 90000 }).catch(() => {}); await p.waitForLoadState("networkidle"); await p.waitForTimeout(5000);
      const r = await p.evaluate(() => { const c = document.querySelector("[data-testid=bet-card]"); return { tier: document.body.getAttribute("data-tier"), url: location.pathname, cls: +window.__cls.toFixed(4), shifts: window.__all, early: window.__early, late: c ? Math.round(c.getBoundingClientRect().height) : null, earlySlots: window.__earlySlots, slotsVisible: [...document.querySelectorAll("[data-testid=log-bet-slot]")].filter((s) => s.getBoundingClientRect().height > 0).length, placed: [...document.querySelectorAll("button,a")].filter((x) => /I placed this/i.test(x.textContent)).length, cards: document.querySelectorAll("[data-testid=bet-card]").length, cents: /\d\s?¢|\bcents?\b/i.test(document.body.innerText), disc: (document.querySelector("footer")?.innerText ?? "").includes("Market analytics, not financial advice. Based on past results. 18+.") }; });
      runs.push(r.cls); log(`${plan} ${w} run${i + 1}: ${JSON.stringify(r)}`);
      if (i === 0) await p.screenshot({ path: `${out}/home-${plan}-${w}.png` });
      if (i === 0 && w === 390) for (const path of ["/pricing", "/about", "/terms", "/m/" + (await p.evaluate(() => document.querySelector("[data-market-id]")?.getAttribute("data-market-id")))]) { await p.goto(base + path); await p.waitForLoadState("networkidle"); log(`${plan} ${path}: body data-tier=${await p.evaluate(() => document.body.getAttribute("data-tier"))} placed=${await p.evaluate(() => [...document.querySelectorAll("button,a")].filter((x) => /I placed this/i.test(x.textContent)).length)} disc=${await p.evaluate(() => (document.querySelector("footer")?.innerText ?? "").includes("18+"))}`); }
      await ctx.close();
    }
    log(`== ${plan} ${w}: worst CLS ${Math.max(...runs)} (runs ${runs.join(", ")})`);
  }
}
await b.close();
