// Shared walk helpers. Run with cwd = apps/web so require('playwright') resolves.
const path = require("path");
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3893";
const OUT = process.env.OUT;
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";

async function start(w, h, tag) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: false, baseURL: BASE,
    extraHTTPHeaders: { "x-e2e-device": `${tag}-${Date.now()}` } });
  await ctx.addInitScript(() => {
    const W = window;
    W.__cls = 0; W.__shifts = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) {
          W.__cls += e.value;
          W.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((s) => (s.node && s.node.nodeName ? s.node.nodeName + "." + String(s.node.className || "").slice(0, 40) + " '" + String(s.node.textContent || "").slice(0, 40) + "'" : "?") + ` ${s.previousRect.y}->${s.currentRect.y} h${s.previousRect.height}->${s.currentRect.height}`) });
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
  });
  const D = +(process.env.PATCH_DELAY || 0);
  if (D) await ctx.route("**/api/data/profile", async (r) => { if (r.request().method() === "PATCH") await new Promise((res) => setTimeout(res, D)); await r.continue(); });
  const page = await ctx.newPage();
  const log = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.push(`[console.${m.type()}] ${page.url()} :: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => log.push(`[pageerror] ${page.url()} :: ${String(e).slice(0, 300)}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/")) log.push(`[http ${r.status()}] ${r.request().method()} ${r.url()}`); });
  return { browser, ctx, page, log };
}

let n = 0;
async function shot(page, prefix, name, full = false) {
  n++;
  const f = `${prefix}-${String(n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, f), fullPage: full });
  return f;
}

async function audit(page, label) {
  await page.waitForTimeout(300);
  const r = await page.evaluate((DISC) => {
    const text = document.body.innerText;
    const foot = Array.from(document.querySelectorAll("footer")).map((f) => f.innerText).join(" | ");
    const cents = (text.match(/[^\n]{0,30}(\d+\s?¢|\bcents?\b|\$0\.\d\d|\b0\.\d\d\b|\b\d+c\b)[^\n]{0,30}/gi) || []).slice(0, 5);
    const hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
    return { url: location.pathname + location.search, h1: Array.from(document.querySelectorAll("h1")).map((h) => h.innerText).join(" / "), disc: text.includes(DISC), footDisc: foot.includes(DISC),
      cls: +(window.__cls || 0).toFixed(4), shifts: (window.__shifts || []).slice(0, 6), cents, hscroll };
  }, DISC);
  const line = `[audit ${label}] ${r.url} h1="${r.h1}" disc=${r.disc}/${r.footDisc} cls=${r.cls} hscroll=${r.hscroll}` + (r.cents.length ? ` CENTS=${JSON.stringify(r.cents)}` : "") + (r.shifts.length ? ` shifts=${JSON.stringify(r.shifts)}` : "");
  console.log(line);
  return r;
}

async function text(page, max = 2500) { return (await page.evaluate(() => document.body.innerText)).slice(0, max); }

const inbox = async (page, email) => (await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json()).url;

module.exports = { start, shot, audit, text, inbox, BASE, OUT, DISC };
