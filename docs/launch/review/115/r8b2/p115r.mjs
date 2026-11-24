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
const PLANS = (process.env.PLANS || "out,free,pro,premium").split(",");
const WS = (process.env.WS || "390,1440").split(",").map(Number);
const LEGS = "6674492:0,7077573:0";
const st = (p) => p.evaluate(() => { const r = { cls: +window.__cls.toFixed(4), shifts: window.__all.splice(0) }; window.__cls = 0; return r; });
const legsH = (p) => p.getByTestId("combo-legs").evaluate((el) => Math.round(el.getBoundingClientRect().height));
const noteT = (p) => p.getByTestId("combo-note").innerText();
for (const plan of PLANS) for (const w of WS) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 }, hasTouch: w < 768, isMobile: w < 768 }); await ctx.addInitScript(initX);
  const p = await ctx.newPage();
  if (plan !== "out") await signIn(p, plan, `p115-${plan}-${w}-${Date.now()}@example.com`);
  let mode = "pass";
  await p.route("**/api/check/leg", async (r) => { if (mode === "abort") return r.abort(); if (mode === "slow") await new Promise((x) => setTimeout(x, 900)); await r.continue(); });
  const tag = `${plan} ${w}`;
  const fresh = async () => { await p.goto(base + "/check/combo"); await p.evaluate(() => sessionStorage.clear()); await p.goto(`${base}/check/combo?legs=${LEGS}`); await p.getByTestId("combo-leg").nth(1).waitFor({ timeout: 60000 }); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500); await st(p); };
  const input = p.getByLabel("Add a bet by link or words");
  const add = () => p.getByRole("button", { name: "Add", exact: true }).click();
  // real-user style: tap the field, paste (keyboard insertText = what a paste does), tap Add
  const paste = async (v) => { await input.click(); await input.fill(""); await p.keyboard.insertText(v); };
  for (const [kind, link, m] of [["404", "https://polymarket.com/event/not-a-real-market-xyz", "pass"], ["404-slow", "https://polymarket.com/event/not-a-real-market-xyz", "slow"], ["network", "https://polymarket.com/event/anything-else-abc", "abort"], ["dup-us-market", "https://polymarket.us/market/aec-cfb-7077573", "slow"]]) {
    await fresh(); mode = m;
    const h0 = await legsH(p);
    await paste(link); await add();
    await p.waitForFunction(() => { const t = document.querySelector('[data-testid=combo-note]')?.textContent ?? ""; return t && !/Looking it up/.test(t); }, null, { timeout: 30000 });
    const nt = await noteT(p);
    await p.waitForTimeout(600); const a = await st(p); const hHeld = await legsH(p);
    await p.waitForTimeout(6000); const idle = await st(p); const hIdle = await legsH(p);
    if (w < 768) await input.tap(); else await input.click(); await p.keyboard.press("x"); await p.waitForTimeout(800);
    const k = await st(p); const hAfter = await legsH(p);
    log(`${tag} ${kind}: note="${nt}" legs h ${h0} -> held ${hHeld} -> idle 6s ${hIdle} -> after keystroke ${hAfter} | CLS to refusal ${a.cls} idle ${idle.cls} keystroke(counted) ${k.cls} | keystroke shifts ${JSON.stringify(k.shifts)} | uncounted earlier ${JSON.stringify(a.shifts.filter((s) => !s.input))}`);
    if (kind === "404") await p.screenshot({ path: `${out_}/refused-${plan}-${w}.png` });
    mode = "pass";
  }
  // event links (dup) and a different market of the same event (should add); event 1335826: 7077573 (leg) + 7077574
  for (const [kind, link, expect] of [["pm-event", "https://polymarket.com/event/cfb-miaoh-kentst-2026-11-17", "dup"], ["us-event", "https://polymarket.us/event/cfb-miaoh-kentst-2026-11-17", "dup"], ["us-market-sibling", "https://polymarket.us/market/aec-cfb-7077574", "add"], ["pm-market-sibling", "https://polymarket.com/event/cfb-miaoh-kentst-2026-11-17/cfb-miaoh-kentst-2026-11-17-1q", "add?"]]) {
    await fresh();
    await paste(link); await add();
    await p.waitForFunction(() => { const t = document.querySelector('[data-testid=combo-note]')?.textContent ?? ""; return !/Looking it up/.test(t); }, null, { timeout: 30000 }); await p.waitForTimeout(1500);
    const legs = await p.getByTestId("combo-leg").allInnerTexts();
    const direct = await p.evaluate(async (l) => { const r = await fetch("/api/check/leg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link: l }) }); const j = await r.json().catch(() => null); return { status: r.status, id: j?.market?.id, ev: j?.market?.event_id, q: j?.market?.question }; }, link);
    log(`${tag} ${kind} (expect ${expect}): note="${await noteT(p)}" legs=${legs.length} [${legs.map((x) => x.split("\n")[0].slice(0, 45)).join(" | ")}] server resolves to ${JSON.stringify(direct)}`);
  }
  // (cautious) explanation
  await fresh();
  const btn = p.getByTestId("combo-check-btn");
  if (await btn.isVisible().catch(() => false)) {
    await btn.click(); await p.getByTestId("combo-score").waitFor({ timeout: 30000 }).catch(() => {});
    const page = await p.evaluate(() => { const t = document.body.innerText; return { cautiousWord: (t.match(/cautious/gi) || []).length, scoreText: document.querySelector('[data-testid=combo-score]')?.innerText.replace(/\s+/g, " ").slice(0, 300) }; });
    await p.getByTestId("combo-why").locator("summary").click().catch(() => {}); await p.waitForTimeout(500);
    const why = await p.evaluate(() => ({ expl: document.querySelector('[data-testid=combo-why-cautious]')?.innerText ?? null, n: (document.body.innerText.match(/cautious chance, a little below/g) || []).length, cautiousAll: (document.body.innerText.match(/cautious/gi) || []).length, cents: /\d\s?¢|\bcents?\b/i.test(document.body.innerText), disc: (document.querySelector("footer")?.innerText ?? "").includes("Market analytics, not financial advice. Based on past results. 18+."), hscroll: document.documentElement.scrollWidth > innerWidth }));
    log(`${tag} cautious: before-why ${JSON.stringify(page)} after-why ${JSON.stringify(why)}`);
    await p.getByTestId("combo-why").scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({ path: `${out_}/why-${plan}-${w}.png` });
  } else log(`${tag} no check button`);
  await ctx.close();
}
await b.close();
