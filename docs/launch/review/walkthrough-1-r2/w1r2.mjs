import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium, devices } = require("@playwright/test");
const fs = await import("fs");
const base = "http://localhost:3755", OUT = process.env.OUT, IDS = (process.env.IDS || "7088975").split(",");
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const log = (s) => { console.log(s); fs.appendFileSync(`${OUT}/walk.log`, s + "\n"); };
const initX = () => { window.__cls = 0; window.__sh = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls += e.value; window.__sh.push(`${e.value.toFixed(4)} ${(e.sources || []).slice(0, 2).map((s) => `${s.node?.getAttribute?.("data-testid") ?? s.node?.nodeName}:${(s.node?.textContent ?? "").trim().slice(0, 25)} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`).join(",")}`); } }).observe({ type: "layout-shift", buffered: true }); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const facts = (p) => p.evaluate((DISC) => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden"; };
  const tab = [...document.querySelectorAll("nav")].find((n) => vis(n) && getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().bottom >= innerHeight - 2);
  const tabTop = tab ? tab.getBoundingClientRect().top : innerHeight;
  const small = [...document.querySelectorAll("a,button,input[type=checkbox],select,[role=tab]")].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 && !(el.closest("p") && el.tagName === "A" && el.closest("p").innerText.length > (el.innerText.length + 20)); })
    .map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName}:${(el.innerText || el.getAttribute("aria-label") || el.type || "").trim().replace(/\s+/g, " ").slice(0, 28)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
  const btn = (re) => [...document.querySelectorAll("a,button")].filter(vis).find((x) => re.test((x.innerText || "").trim()) && !x.closest("header") && !x.closest("nav"));
  const rect = (el) => el ? (({ top, bottom, left, right, height }) => ({ top: Math.round(top), bottom: Math.round(bottom), h: Math.round(height) }))(el.getBoundingClientRect()) : null;
  const h1 = document.querySelector("main h1"); const sub = h1?.nextElementSibling;
  const tabs = [...document.querySelectorAll("[role=tab]")].map((t) => `${t.innerText.trim()}:${t.getAttribute("aria-selected")}`);
  const navCur = [...document.querySelectorAll("a[aria-current=page]")].filter(vis).map((a) => `${a.innerText.trim()}@${a.closest("nav")?.getAttribute("aria-label") ?? a.closest("header") ? "hdr" : "?"}`);
  const bet = document.querySelector("[data-testid=signup-bet]"); const lh = bet ? parseFloat(getComputedStyle(bet).lineHeight) : 1;
  const metas = [...document.querySelectorAll("meta[name=description],meta[property^='og:'],meta[name^='twitter:']")].map((m) => m.content).join(" || ");
  const txt = document.body.innerText;
  return { url: location.pathname + location.search, title: document.title, h1: h1?.innerText, sub: sub?.tagName === "P" ? sub.innerText : null,
    price: (txt.match(/Market price:[^\n]*/) || [""])[0], tabTop: Math.round(tabTop),
    signupFree: rect(btn(/^Sign up free$/i)), createAcct: rect(btn(/^Create account$/i)), google: rect(btn(/Google/i)), pw: !!document.querySelector("input[type=password]") && vis(document.querySelector("input[type=password]")),
    tabs, navCur, bet: bet ? { text: bet.innerText, lines: Math.round(bet.getBoundingClientRect().height / lh), clipped: bet.scrollHeight > bet.clientHeight + 1, over: bet.scrollWidth > bet.clientWidth + 1 } : null,
    dblPunct: (txt + " " + metas).match(/[?!.]\.(?!\.)|\?\?/g) ? ((txt + " " + metas).match(/.{30}[?!]\.(?!\.).{0,5}/g) || []).slice(0, 3) : [],
    cls: +window.__cls.toFixed(4), shifts: window.__sh.slice(0, 4), disc: (document.querySelector("footer")?.innerText ?? "").includes(DISC),
    cents: /\d\s?¢|\bcents?\b/i.test(txt), hs: document.documentElement.scrollWidth > innerWidth,
    jargon: [...new Set((txt.match(/\b(EV|expected value|Kelly|bps|basis points|edge|vig|overround|z-score|calibrat\w+|logit|CI)\b/g) || []))],
    personal: [...new Set((txt.match(/\b(for you|your picks|picked for you|based on your|recommended for you)\b/gi) || []))],
    small: [...new Set(small)].slice(0, 20) };
}, DISC);
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [1440, 900]].filter(([w]) => !process.env.WS || process.env.WS.split(",").includes(String(w)))) for (const ID of IDS) {
  if (process.env.SKIP && process.env.SKIP.split(",").includes(`${w}:${ID}`)) continue;
  const mob = w < 768;
  const opts = mob ? { ...devices["iPhone 13"], viewport: { width: w, height: h } } : { viewport: { width: w, height: h } }; delete opts.defaultBrowserType;
  const ctx = await b.newContext({ ...opts }); await ctx.addInitScript(initX);
  await ctx.route(/\/api\/funnel/, (r) => r.request().method() === "GET" ? r.continue() : r.fulfill({ status: 204 }));
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror@" + p.url().replace(base, "") + " " + e.message.slice(0, 140))); p.on("console", (m) => { if (m.type() === "error") errs.push("console@" + p.url().replace(base, "") + " " + m.text().slice(0, 140)); });
  const step = async (n) => { await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(1500); const f = await facts(p); log(`${w}x${h} id${ID} ${n} ${JSON.stringify(f)}`); await p.screenshot({ path: `${OUT}/${w}-${ID}-${n}-fold.png` }); await p.screenshot({ path: `${OUT}/${w}-${ID}-${n}-full.png`, fullPage: true }); return f; };
  await p.goto(`${base}/m/${ID}?ref=abcd1234`, { waitUntil: "load", referer: "https://www.tiktok.com/" }); await step("1-m");
  // scroll the Sign up free CTA into view: is it clear of the tab bar?
  const cta = p.getByRole("link", { name: /^Sign up free$/i }).filter({ hasNot: p.locator("header") }).last();
  await cta.scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(300);
  const cr = await cta.boundingBox().catch(() => null); const tabTop = await p.evaluate(() => { const n = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().height > 0 && n.getBoundingClientRect().bottom >= innerHeight - 2); return n ? n.getBoundingClientRect().top : innerHeight; });
  const hit = cr ? await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest("a")?.innerText?.trim() ?? e?.tagName; }, [cr.x + cr.width / 2, cr.y + cr.height / 2]) : null;
  log(`${w}x${h} id${ID} 1b-cta scrolled: ${JSON.stringify(cr && { top: Math.round(cr.y), bottom: Math.round(cr.y + cr.height), h: Math.round(cr.height) })} tabTop ${Math.round(tabTop)} centerHits "${hit}"`);
  await cta.click(); await p.waitForURL(/\/signup/, { timeout: 30000 }); await step("2-signup");
  const ca = p.getByRole("button", { name: /^Create account$/i }).first(); await ca.scrollIntoViewIfNeeded().catch(() => {});
  const car = await ca.boundingBox().catch(() => null); const hit2 = car ? await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest("button")?.innerText?.trim() ?? e?.tagName; }, [car.x + car.width / 2, car.y + car.height / 2]) : null;
  log(`${w}x${h} id${ID} 2b-create scrolled: ${JSON.stringify(car && { top: Math.round(car.y), bottom: Math.round(car.y + car.height), h: Math.round(car.height) })} centerHits "${hit2}"`);
  await p.goto(`${base}/state?next=${encodeURIComponent(`/m/${ID}`)}`, { waitUntil: "load" }); await step("3-state");
  await p.goto(`${base}/pricing`, { waitUntil: "load" }); await step("4-pricing");
  await p.goBack().catch((e) => errs.push("back: " + e.message.slice(0, 80))); await p.waitForURL(/\/state/, { timeout: 30000 }).catch((e) => errs.push("back url: " + e.message.slice(0, 80))); await step("5-back");
  log(`${w}x${h} id${ID} errors ${JSON.stringify(errs)}`);
  await ctx.close();
}
await b.close();
