// Reviewer probe for PR #106 (T-wt2d) at c4d2e93. usage: node rv106.mjs <web-dir> <outdir> <phase:free|paid|newempty|picker|teaser> [w] [tier]
import { createRequire } from "module";
const [webdir, out, phase, wArg, tierArg] = process.argv.slice(2);
const require = createRequire(`${webdir}/package.json`);
const { chromium } = require("@playwright/test");
const base = `http://localhost:${process.env.PORT||3755}`;
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const log = (...a) => console.log(...a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))));
const widths = wArg ? [+wArg] : [390, 1440];

const clsInit = () => {
  window.__cls = 0; window.__shifts = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).slice(0, 3).map((s) => `${s.node?.tagName ?? "?"}.${s.node?.getAttribute?.("data-testid") ?? String(s.node?.className ?? "").slice(0, 30)} ${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`) }); } }).observe({ type: "layout-shift", buffered: true });
};
const hideStale = () => { const s = document.createElement("style"); s.textContent = 'p[role="status"].border-warning\\/40{display:none!important}'; (document.head || document.documentElement).appendChild(s); };
async function ctxFor(w, dev, { fresh = false } = {}) {
  const mobile = w === 390;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, hasTouch: mobile, isMobile: mobile, extraHTTPHeaders: { "x-e2e-device": `rv106-${dev}-${w}-${Date.now()}` } });
  await ctx.addInitScript(clsInit);
  if (fresh) await ctx.addInitScript(hideStale);
  return ctx;
}
async function facts(page) {
  return page.evaluate((DISC) => {
    const f = document.querySelector("footer");
    const txt = document.body.innerText;
    return {
      url: location.pathname + location.search, cls: +window.__cls.toFixed(4), shifts: window.__shifts.slice(-5),
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
      disclaimer: (f?.innerText ?? "").includes(DISC), cents: /¢|\d\s?cents?\b/i.test(txt),
      cards: document.querySelectorAll('[data-testid="bets-list"] article').length,
      locked: document.querySelectorAll('[data-testid="locked-bets"]').length,
      upsell: /Track your bets with Pro/.test(txt),
      empty: document.querySelector('[data-testid="empty-state"]')?.innerText.replace(/\n+/g, " | ") ?? null,
      h1: document.querySelector("h1")?.innerText ?? null, zeroBets: /\b0 bets\b/.test(txt),
      tour: document.querySelector('[data-testid="tour"]')?.innerText.replace(/\n+/g, " | ").slice(0, 200) ?? null,
    };
  }, DISC);
}
const go = (page, p) => page.goto(base + p, { waitUntil: "load", timeout: 180000 });
const shot = (page, tag) => page.screenshot({ path: `${out}/${tag}.png` });
const skipTour = async (page) => { const b = page.getByRole("button", { name: "Skip tour" }); await b.waitFor({ timeout: 10000 }).catch(() => {}); if (await b.isVisible().catch(() => false)) await b.click(); };

async function linkSignIn(page, email, { skip = true } = {}) {
  await go(page, `/login`);
  for (let i = 0; i < 30; i++) {
    await page.getByRole("tab", { name: "Email link" }).click();
    if (await page.getByRole("button", { name: "Email me a sign-in link" }).isVisible()) break;
    await page.waitForTimeout(1000);
  }
  await page.locator("input[type=email]").fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 60000 });
  const { url } = await (await page.request.get(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url, { timeout: 180000 });
  await page.waitForURL(/\/onboarding/, { timeout: 120000 });
  if (!skip) return;
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 120000 });
  await page.waitForLoadState("networkidle");
}
async function setTier(page, t) {
  const me = await (await page.request.get(`${base}/api/me`)).json();
  await page.request.patch(`${base}/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: t } });
  log("tier", t, (await (await page.request.get(`${base}/api/me`)).json()).tier);
}
const rect = async (loc) => { const b = await loc.boundingBox({ timeout: 3000 }).catch(() => null); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; };


const tabTop = (page) => page.evaluate(() => { const n = [...document.querySelectorAll('nav[aria-label="Main"]')].find((x) => { const r = x.getBoundingClientRect(); return r.height > 0 && getComputedStyle(x).position === "fixed"; }); const t = n ? n.getBoundingClientRect().top : innerHeight; return t > innerHeight / 2 ? Math.round(t) : innerHeight; });
const banner = (page) => page.evaluate(() => { const b = [...document.querySelectorAll('[role="status"]')].find((x) => /last price scan/.test(x.textContent)); return b ? Math.round(b.getBoundingClientRect().height + 16) : 0; });
const shiftsDetail = () => { window.__det = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput && e.value > 0.002) window.__det.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), fonts: document.fonts.status, src: (e.sources || []).slice(0, 4).map((s) => `${s.node?.nodeName}.${String(s.node?.className ?? "").slice(0, 40)} "${(s.node?.textContent ?? "").slice(0, 40).replace(/\s+/g, " ")}" y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`) }); }).observe({ type: "layout-shift", buffered: true }); };
async function honest(page, tag, w) {
  const r = await page.evaluate(() => {
    const e = document.querySelector('[data-testid="empty-state"]'); if (!e) return null;
    const line = [...e.querySelectorAll("p")].find((p) => /Widen your topics/.test(p.textContent));
    const btn = [...e.querySelectorAll("button")].find((b) => /See all best bets/.test(b.textContent));
    const lnk = [...e.querySelectorAll("a")].find((b) => /Choose more topics/.test(b.textContent));
    const R = (x) => x ? { top: Math.round(x.getBoundingClientRect().top + scrollY), bottom: Math.round(x.getBoundingClientRect().bottom + scrollY) } : null;
    return { h1: document.querySelector("h1")?.innerText, h1r: R(document.querySelector("h1")), line: R(line), btn: R(btn), link: R(lnk), linkHref: lnk?.getAttribute("href"), lineText: line?.textContent, scrollY: Math.round(scrollY) };
  });
  const b = await banner(page), tt = await tabTop(page);
  log(tag, "honest", r, "staleBanner", b, "tabTop", tt, "btnBottomFresh", r?.btn ? r.btn.bottom - b : null, "lineBottomFresh", r?.line ? r.line.bottom - b : null, "ok", !!r && /^No best bets in .+ today$/.test(r.h1) && r.btn.bottom - b <= tt && r.line.bottom - b <= tt);
  return r;
}
async function pickNone(page) {
  await go(page, "/onboarding"); await page.waitForLoadState("networkidle");
  const h = await page.waitForFunction(() => { for (const b of document.querySelectorAll("fieldset button[aria-describedby]")) if (!b.disabled && document.getElementById(b.getAttribute("aria-describedby"))?.textContent === "none open") return b.getAttribute("aria-describedby"); return null; }, undefined, { timeout: 60000 });
  const did = await h.jsonValue(); const tile = page.locator(`button[aria-describedby="${did}"]`);
  const name = (await tile.innerText()).replace("none open", "").trim();
  await tile.click(); await page.waitForFunction((d) => document.querySelector(`button[aria-describedby="${d}"]`)?.getAttribute("aria-pressed") === "true", did, { timeout: 30000 });
  await page.getByRole("button", { name: "Next", exact: true }).click(); await page.getByRole("button", { name: "Next", exact: true }).click();
  return name;
}

// ---- (b)(d) new Pro/Premium user, only topic has none open: honest landing, 5 landings CLS, See all (list 900 ms, backtest 6 s, book 9 s)
if (phase === "land") for (const w of widths) for (const t of (tierArg ? [tierArg] : ["pro", "premium"])) {
  const tag = `land-${t}-${w}`;
  const ctx = await ctxFor(w, tag); await ctx.addInitScript(shiftsDetail); const page = await ctx.newPage();
  await linkSignIn(page, `rv106c-${tag}-${Date.now()}@example.com`, { skip: false });
  await setTier(page, t);
  const name = await pickNone(page); log(tag, "picked", name);
  await page.evaluate(() => { window.__cls = 0; window.__shifts = []; window.__det = []; });
  await page.getByRole("button", { name: "Show my best bets" }).click();
  await page.getByTestId("empty-state").waitFor({ timeout: 60000 });
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
  await honest(page, tag + " first", w);
  const f0 = await facts(page); const runs = [f0.cls];
  log(tag, "first landing", f0, "det", await page.evaluate(() => window.__det));
  log(tag, "where '0 bets'", await page.evaluate(() => { const out = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { if (/\b0 bets\b/.test(n.data)) { const el = n.parentElement; out.push({ text: n.data.slice(0, 120), el: el.tagName + "." + String(el.className).slice(0, 50), visible: !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden", srOnly: !!el.closest(".sr-only"), aria: el.closest("[aria-live],[role=status]")?.outerHTML.slice(0, 120) ?? null }); } } return out; }));
  await shot(page, `${tag}-landing`);
  const tour = await page.getByTestId("tour").innerText().catch(() => null); log(tag, "tour", tour?.replace(/\n+/g, " | ").slice(0, 160));
  for (let i = 2; i <= 5; i++) {
    await go(page, "/"); await page.getByTestId("empty-state").waitFor({ timeout: 60000 });
    await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
    const f = await facts(page); runs.push(f.cls);
    await honest(page, `${tag} load${i}`, w);
    log(tag, `load${i}`, { url: f.url, cls: f.cls, h1: f.h1, zeroBets: f.zeroBets, disc: f.disclaimer, cents: f.cents, hscroll: f.hscroll }, "det", await page.evaluate(() => window.__det));
  }
  log(tag, "LANDING CLS runs", runs, "worst", Math.max(...runs));
  const sk = page.getByRole("button", { name: "Skip tour" }); if (await sk.isVisible().catch(() => false)) await sk.click();
  await go(page, "/"); await page.getByTestId("empty-state").waitFor({ timeout: 60000 }); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
  if (await sk.isVisible().catch(() => false)) await sk.click();
  await page.route("**/api/flags*", async (r) => { await new Promise((x) => setTimeout(x, 900)); await r.continue(); });
  await page.route("**/api/backtest*", async (r) => { await new Promise((x) => setTimeout(x, 6000)); await r.continue(); });
  await page.route("**/api/book*", async (r) => { await new Promise((x) => setTimeout(x, 9000)); await r.continue(); });
  await page.evaluate(() => { window.__cls = 0; window.__shifts = []; window.__det = []; });
  await page.getByTestId("empty-state").getByRole("button", { name: "See all best bets" }).click();
  await page.locator("article[data-row]").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  const a2 = await facts(page); log(tag, "SEE-ALL list late, 2s after cards", { cls: a2.cls, cards: a2.cards, h1: a2.h1 }, "det", await page.evaluate(() => window.__det));
  await page.waitForTimeout(16000);
  const a3 = await facts(page); log(tag, "SEE-ALL + backtest 6s + book 9s, 18s after cards", { cls: a3.cls, cards: a3.cards, url: a3.url, disc: a3.disclaimer, cents: a3.cents, hscroll: a3.hscroll }, "det", await page.evaluate(() => window.__det));
  await shot(page, `${tag}-see-all`);
  // a returning user's "/" with the late backtest alone, no tap: the cards' tested record landing
  await page.unroute("**/api/flags*");
  await ctx.close();
}

// ---- (d) late backtest on a normal Best bets list, Pro/Premium, no tap at all
if (phase === "late") for (const w of widths) for (const t of (tierArg ? [tierArg] : ["pro", "premium"])) {
  const tag = `late-${t}-${w}`;
  const ctx = await ctxFor(w, tag); await ctx.addInitScript(shiftsDetail); const page = await ctx.newPage();
  await linkSignIn(page, `rv106c-${tag}-${Date.now()}@example.com`);
  await setTier(page, t);
  const sk = page.getByRole("button", { name: "Skip tour" });
  await go(page, "/"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000); if (await sk.isVisible().catch(() => false)) await sk.click();
  await page.route("**/api/flags*", async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
  await page.route("**/api/backtest*", async (r) => { await new Promise((x) => setTimeout(x, 6000)); await r.continue(); });
  await page.route("**/api/book*", async (r) => { await new Promise((x) => setTimeout(x, 9000)); await r.continue(); });
  for (const p of ["/", "/bets"]) {
    await go(page, p); await page.locator("article[data-row]").first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(18000);
    const f = await facts(page); log(tag, p, "late backtest/book, 18s", { cls: f.cls, cards: f.cards, h1: f.h1, disc: f.disclaimer, cents: f.cents, hscroll: f.hscroll }, "det", await page.evaluate(() => window.__det));
  }
  await shot(page, `${tag}`);
  await ctx.close();
}

// ---- (c) onboarding Next before hydration; tiles too (fix 3 of the earlier review)
if (phase === "next") for (const w of widths) {
  const tag = `next-${w}`;
  const ctx = await ctxFor(w, tag); const page = await ctx.newPage();
  await linkSignIn(page, `rv106c-${tag}-${Date.now()}@example.com`, { skip: false });
  const p2 = await ctx.newPage();
  let hold = true;
  await p2.route(/\/_next\/static\/chunks\/.*\.js/, async (r) => { while (hold) await new Promise((x) => setTimeout(x, 200)); await r.continue(); });
  p2.goto(base + "/onboarding", { waitUntil: "commit" }).catch(() => {});
  await p2.waitForSelector("fieldset button", { timeout: 120000 });
  await p2.waitForTimeout(800);
  const look = () => p2.evaluate(() => { const st = (b) => { if (!b) return null; const cs = getComputedStyle(b); return { disabled: b.disabled, opacity: cs.opacity, cursor: cs.cursor, bg: cs.backgroundColor, text: b.textContent.trim() }; }; const bs = [...document.querySelectorAll("button")]; return { next: st(bs.find((x) => /^(Next|Show my best bets)$/.test(x.textContent.trim()))), skip: st(bs.find((x) => /Skip setup/.test(x.textContent))), tile: st(document.querySelector("fieldset button")), step: document.querySelector("main")?.innerText.match(/Step \d of \d|\d of 3/)?.[0] ?? null, h: document.querySelector("h1,h2")?.textContent }; });
  const pre = await look(); log(tag, "pre-hydration", pre);
  await p2.screenshot({ path: `${out}/${tag}-pre-hydration.png` });
  const nb = p2.getByRole("button", { name: "Next", exact: true }); const bb = await nb.boundingBox();
  if (w === 390) await p2.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await p2.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p2.waitForTimeout(400);
  const tb = await p2.locator("fieldset button").first().boundingBox();
  if (w === 390) await p2.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2); else await p2.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
  hold = false;
  await p2.waitForFunction(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Next"); return b && !b.disabled; }, null, { timeout: 120000 });
  await p2.waitForTimeout(2000);
  const post = await look(); log(tag, "post-hydration (after pre-hydration taps on Next and tile 1)", post, "tile1 pressed", await p2.locator("fieldset button").first().getAttribute("aria-pressed"));
  await p2.screenshot({ path: `${out}/${tag}-post-hydration.png` });
  // hover colour while enabled and disabled
  await p2.getByRole("button", { name: "Next", exact: true }).click(); await p2.waitForTimeout(800);
  log(tag, "after a real tap on Next", await look());
  await ctx.close();
}

// ---- earlier blocker: Free filter change empties the list -> locked card message in first view; Free new user with none-open topic
if (phase === "free") for (const w of widths) {
  const tag = `free-${w}`;
  const ctx = await ctxFor(w, tag, { fresh: true }); await ctx.addInitScript(shiftsDetail); const page = await ctx.newPage();
  await linkSignIn(page, `rv106c-${tag}-${Date.now()}@example.com`);
  await go(page, "/bets?fav=0"); await page.getByTestId("bets-list").locator("article").first().waitFor({ timeout: 60000 });
  await skipTour(page); await page.evaluate(() => scrollTo(0, 0)); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  log(tag, "full", await facts(page));
  await page.route("**/api/flags*", async (r) => { await new Promise((x) => setTimeout(x, 1500)); const res = await r.fetch(); const j = await res.json(); const u = new URL(r.request().url()); await r.fulfill({ response: res, json: u.searchParams.has("t") ? { ...j, rows: [], groups: [], total: Math.max(j.total, 5), free_daily: j.free_daily ?? 10 } : j }); });
  await page.evaluate(() => { window.__cls = 0; window.__shifts = []; window.__det = []; });
  await page.evaluate(() => history.pushState(null, "", "/bets?fav=1&t=sports.nfl"));
  await page.getByTestId("show-free-sample").waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  const lk = page.getByTestId("locked-bets").first();
  const ft = await lk.evaluate((el) => { const p = el.querySelector("p,h2,h3"); const r = p?.getBoundingClientRect(); return p ? { t: p.textContent.slice(0, 90), bottom: Math.round(r.bottom + scrollY) } : null; }).catch(() => null);
  log(tag, "empty (blocker check)", { locked: await rect(lk), lockedFirstText: ft, tabTop: await tabTop(page), showFree: await rect(page.getByTestId("show-free-sample")) }, await facts(page), "det", await page.evaluate(() => window.__det));
  await shot(page, `${tag}-empty`);
  await page.unroute("**/api/flags*");
  await page.evaluate(() => { window.__cls = 0; window.__shifts = []; });
  await page.getByTestId("show-free-sample").click().catch((e) => log("no show btn", e.message));
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
  log(tag, "show-free", await facts(page));
  await ctx.close();
  // new Free user whose only topic has none open
  const ctx2 = await ctxFor(w, tag + "-new"); await ctx2.addInitScript(shiftsDetail); const p3 = await ctx2.newPage();
  await linkSignIn(p3, `rv106c-${tag}-new-${Date.now()}@example.com`, { skip: false });
  const name = await pickNone(p3); log(tag, "new free picked", name);
  await p3.evaluate(() => { window.__cls = 0; window.__shifts = []; });
  await p3.getByRole("button", { name: "Show my best bets" }).click();
  await p3.waitForURL((u) => u.pathname !== "/onboarding", { timeout: 60000 }); await p3.waitForLoadState("networkidle"); await p3.waitForTimeout(5000);
  const f = await facts(p3);
  log(tag, "new free landing", f, "tabTop", await tabTop(p3), "showFree", await rect(p3.getByTestId("show-free-sample")), "locked", await rect(p3.getByTestId("locked-bets").first()), "det", await p3.evaluate(() => window.__det));
  await shot(p3, `${tag}-new-landing`);
  await ctx2.close();
}

// ---- signed out: landing, /bets, /m teaser, /pricing
if (phase === "out") for (const w of widths) {
  const tag = `out-${w}`;
  const ctx = await ctxFor(w, tag); await ctx.addInitScript(shiftsDetail); const page = await ctx.newPage();
  for (const p of ["/", "/bets", "/m/6674492", "/pricing", "/track-record"]) {
    await go(page, p); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
    const f = await facts(page); log(tag, p, { url: f.url, cls: f.cls, h1: f.h1, disc: f.disclaimer, cents: f.cents, hscroll: f.hscroll, cards: f.cards, empty: f.empty }, "det", await page.evaluate(() => window.__det));
  }
  await ctx.close();
}

// ---- normal Best bets regression, Free/Pro/Premium; the "See how we track results" link position
if (phase === "paid") for (const w of widths) for (const t of (tierArg ? [tierArg] : ["free", "pro", "premium"])) {
  const tag = `bb-${t}-${w}`;
  const ctx = await ctxFor(w, tag); await ctx.addInitScript(shiftsDetail); const page = await ctx.newPage();
  await linkSignIn(page, `rv106c-${tag}-${Date.now()}@example.com`);
  if (t !== "free") await setTier(page, t);
  await go(page, "/"); await page.getByTestId("bets-list").locator("article").first().waitFor({ timeout: 60000 }).catch(() => {});
  await skipTour(page); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
  const f = await facts(page);
  const link = await page.getByRole("link", { name: "See how we track results" }).first().evaluate((a) => { const r = a.getBoundingClientRect(); const p = a.parentElement.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(a).display, pTop: Math.round(p.top), pH: Math.round(p.height) }; }).catch(() => null);
  log(tag, f, "trackLink", link, "det", await page.evaluate(() => window.__det));
  await shot(page, `${tag}-home`);
  for (const p of ["/bets", "/markets", "/settings", "/account", "/track-record"]) { await go(page, p); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); const g = await facts(page); log(tag, p, { cls: g.cls, disc: g.disclaimer, cents: g.cents, hscroll: g.hscroll }); }
  await ctx.close();
}
await browser.close();
