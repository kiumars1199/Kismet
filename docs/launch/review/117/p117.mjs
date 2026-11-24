// #117 reviewer probe: signup fold. usage: WT=.. node p117.mjs <port> <out>
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
const fs = await import("fs"); const log = (s) => { console.log(s); fs.appendFileSync(`${out}/p117-fold.log`, s + "\n"); };
const flags = JSON.parse(fs.readFileSync(process.env.WT + "/apps/web/test-results/paid-fixtures/flags.json", "utf8")).flags;
const longest = [...flags].sort((a, b) => b.question.length - a.question.length)[0];
const REAL = [
  "Will the highest temperature in New York City be between 56-57°F on November 17?",
  "Exact Score: Arsenal FC 1 - 0 BV Borussia 09 Dortmund?",
  "Will Jean-Michel Basquiat's “Untitled (Leonardo and His Five Grotesque Heads)” sell for between $40m and $50m at auction?",
  "Will “Horses and Divorces” by Kacey Musgraves featuring Miranda Lambert win Musical Event of the Year at the 2026 CMA Awards?",
];
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [1440, 900], [320, 568]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto(`${base}/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`); const line = p.getByTestId("signup-bet"); await line.waitFor({ timeout: 90000 }); await p.waitForLoadState("networkidle"); await p.waitForTimeout(800);
  const m = async () => p.evaluate((w) => { const l = document.querySelector("[data-testid=signup-bet]"); const btn = [...document.querySelectorAll('[role=tabpanel] button')].find((x) => x.textContent.trim() === "Create account"); const nav = [...document.querySelectorAll('nav[aria-label="Main"]')].find((n) => n.getBoundingClientRect().height > 0 && getComputedStyle(n).position === "fixed"); const limit = w < 768 && nav ? nav.getBoundingClientRect().top : innerHeight; const lh = parseFloat(getComputedStyle(l).lineHeight); return { text: l.innerText.trim(), lines: Math.round(l.getBoundingClientRect().height / lh), btnBottom: Math.round(btn.getBoundingClientRect().bottom), limit: Math.round(limit), margin: Math.round(limit - btn.getBoundingClientRect().bottom), disc: (document.querySelector("footer")?.innerText ?? "").includes("Market analytics, not financial advice. Based on past results. 18+."), hscroll: document.documentElement.scrollWidth > innerWidth }; }, w);
  const r = await m(); log(`${w}x${h} as shipped (longest fixture title, ${longest.question.length} ch): ${JSON.stringify(r)}`);
  await p.screenshot({ path: `${out}/signup-${w}x${h}.png` });
  // the alternative: whole title, up to 3 lines (no clamp)
  for (const t of [longest.question, ...REAL.slice(1)]) {
    await p.evaluate((t) => { const l = document.querySelector("[data-testid=signup-bet]"); l.innerHTML = `Sign up to see Kismet's verdict on ${t}`; l.style.display = "-webkit-box"; l.style.webkitLineClamp = "3"; l.style.webkitBoxOrient = "vertical"; l.style.overflow = "hidden"; }, t);
    const f = await m(); log(`${w}x${h} WHOLE title, 3-line clamp (${t.length} ch): lines ${f.lines}, clipped ${await line.evaluate((e) => e.scrollHeight - e.clientHeight > 1)}, Create account bottom ${f.btnBottom} vs limit ${f.limit} (margin ${f.margin})`);
    if (t === longest.question) await p.screenshot({ path: `${out}/signup-${w}x${h}-whole-3lines.png` });
  }
  await ctx.close();
}
await b.close();
