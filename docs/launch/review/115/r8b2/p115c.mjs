// #115 T-wt3f reviewer probe. usage: WT=.. PLANS=.. node p115.mjs <port> <out>
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
  await page.goto(url).catch(() => {});
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
const out_ = out; import("fs"); const fs = await import("fs"); const log = (s) => { console.log(s); fs.appendFileSync(`${out}/p115.log`, s + "\n"); };
const initX = () => { window.__cls = 0; window.__all = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__all.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), input: e.hadRecentInput, src: (e.sources || []).slice(0, 2).map((s) => `${s.node?.getAttribute?.("data-testid") ?? s.node?.nodeName} ${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`).join(",") }); if (!e.hadRecentInput) window.__cls += e.value; } }).observe({ type: "layout-shift", buffered: true }); };
const LEGS = "6674492:0,7077573:0";
const st = (p) => p.evaluate(() => { const r = { cls: +window.__cls.toFixed(4), shifts: window.__all.splice(0) }; window.__cls = 0; return r; });
const legsH = (p) => p.getByTestId("combo-legs").evaluate((el) => Math.round(el.getBoundingClientRect().height));
const noteT = (p) => p.getByTestId("combo-note").innerText();
const W = +(process.env.W || 390); const ctx = await b.newContext({ viewport: { width: W, height: W < 768 ? 844 : 900 }, hasTouch: W < 768, isMobile: W < 768 }); await ctx.addInitScript(initX);
const p = await ctx.newPage();
const input = p.getByLabel("Add a bet by link or words");
const fresh = async (legs) => { await p.goto(base + "/check/combo"); await p.evaluate(() => sessionStorage.clear()); await p.goto(`${base}/check/combo?legs=${legs}`); await p.getByTestId("combo-leg").nth(legs.split(",").length - 1).waitFor({ timeout: 60000 }); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500); await st(p); };
const refuse = async (enter) => { if (enter) { await (W < 768 ? input.tap() : input.click()); await input.fill(""); await p.keyboard.insertText("https://polymarket.com/event/not-a-real-market-xyz"); await p.keyboard.press("Enter"); await p.getByText("We couldn't find an open market").waitFor({ timeout: 30000 }); await p.waitForTimeout(1500); await st(p); return; } await (W < 768 ? input.tap() : input.click()); await input.fill(""); await p.keyboard.insertText("https://polymarket.com/event/not-a-real-market-xyz"); await (W < 768 ? p.getByRole("button", { name: "Add", exact: true }).tap() : p.getByRole("button", { name: "Add", exact: true }).click()); await p.getByText("We couldn't find an open market").waitFor({ timeout: 30000 }); await p.waitForTimeout(1500); await st(p); };
// (4) what changes the text after a refusal, and is the release counted?
for (const [how, fn] of [
  ["fill() only (old test, no user event)", async () => { await input.fill("https://polymarket.com/event/other"); }],
  ["CDP insertText only (paste via IME, no key/pointer)", async () => { await p.keyboard.insertText("x"); }],
  ["tap field then 1.2s later insertText (mobile long-press paste menu)", async () => { await (W < 768 ? input.tap() : input.click()); await p.waitForTimeout(1200); await p.keyboard.insertText("x"); }],
  ["real tap on the field (touch), no typing", async () => { if (W < 768) await input.tap(); else await input.click(); }],
  ["mouse click on the field, no typing", async () => { await input.click(); }],
  ["Tab from the page into the field, then type", async () => { await p.evaluate(() => document.activeElement?.blur()); await p.locator("body").focus().catch(() => {}); for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); if (await p.evaluate(() => document.activeElement?.id === "combo-q")) break; } await p.waitForTimeout(700); await p.keyboard.type("abc"); }],
  ["Shift+Tab back from the Add button into the field", async () => { await p.getByRole("button", { name: "Add", exact: true }).focus(); await p.waitForTimeout(700); await p.keyboard.press("Shift+Tab"); await p.waitForTimeout(700); await p.keyboard.type("x"); }],
  ["programmatic focus() only (no user input)", async () => { await input.focus(); }],
  ["Enter-submit (field keeps focus), then insertText 1.2s later", "enter"],
  ["Ctrl+A then Ctrl+V-ish (keydown Delete)", async () => { await input.press("Control+a"); await input.press("Delete"); }],
]) {
  await fresh(LEGS); await refuse(fn === "enter"); const h1 = await legsH(p); const foc = await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  if (fn === "enter") { await p.waitForTimeout(1200); await p.keyboard.insertText("x"); } else await fn(); await p.waitForTimeout(900); const r = await st(p); const h2 = await legsH(p);
  log(`(4) W${W} after refusal (focus at refusal: ${foc}), ${how}: legs h ${h1} -> ${h2}, counted CLS ${r.cls}, shifts ${JSON.stringify(r.shifts)}`);
}
// (3) US sibling via the /event/ twin slug form, and the exact-market US dup, and a different-event US twin (control)
for (const [legs, link, expect] of [["7077573:0", "https://polymarket.us/event/aec-cfb-7077574", "add (different market 1Q)"], ["7077573:0", "https://polymarket.us/market/aec-cfb-7077574", "add (different market 1Q)"], ["7077573:0", "https://polymarket.us/event/aec-cfb-7077573", "dup (same market)"], ["7077574:0", "https://polymarket.us/event/aec-cfb-7077573", "add (different market 1H)"], ["7077574:0", "https://polymarket.us/market/aec-cfb-7077573", "add (different market 1H)"], ["7077574:0", "https://polymarket.us/market/aec-cfb-7077574", "dup (same market)"], ["7077573:0", "https://polymarket.com/event/cfb-miaoh-kentst-2026-11-17", "dup (pm.com event link)"], ["7077574:0", "https://polymarket.com/event/cfb-miaoh-kentst-2026-11-17", "dup (pm.com event link)"], ["6674492:0", "https://polymarket.us/event/aec-cfb-7077574", "add (control: other event)"]]) {
  await fresh(legs); await (W < 768 ? input.tap() : input.click()); await input.fill(""); await p.keyboard.insertText(link); await (W < 768 ? p.getByRole("button", { name: "Add", exact: true }).tap() : p.getByRole("button", { name: "Add", exact: true }).click());
  await p.waitForFunction(() => !/Looking it up/.test(document.querySelector('[data-testid=combo-note]')?.textContent ?? ""), null, { timeout: 30000 }); await p.waitForTimeout(1500);
  const legsT = await p.getByTestId("combo-leg").allInnerTexts();
  log(`(3) W${W} legs=${legs} + ${link} expect ${expect}: note="${await noteT(p)}" -> ${legsT.length} legs [${legsT.map((x) => x.split("\n")[0].slice(0, 45)).join(" | ")}]`);
  if (link.endsWith("7077574") && legs === "7077573:0" && link.includes("/market/")) await p.screenshot({ path: `${out_}/us-sibling-${W}.png` });
}
await b.close();
