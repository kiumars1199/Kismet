// Free sweep of nav destinations: disclaimer, widened cents, hscroll, CLS, console, small targets, pending requests on idle timeout.
const L = require("./lib");
const { chromium } = require("playwright");
const S = "/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/wt2r2-scripts";
const ROUTES = ["/markets", "/markets?q=texans", "/watchlist", "/journal", "/track-record", "/tools", "/check/combo", "/combos", "/alerts", "/dashboards", "/status", "/about", "/kalshi", "/state", "/m/__first__", "/check?__second__", "/?view=flags&t=sports.mlb&tour=1"];
(async () => {
  const [w, h] = process.argv[2].split("x").map(Number);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, baseURL: L.BASE, extraHTTPHeaders: { "x-e2e-device": `wt2r2-sweep-${w}-${Date.now()}` } });
  await ctx.addInitScript(() => { window.__cls = 0; window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  const page = await ctx.newPage();
  const log = []; const inflight = new Map();
  page.on("console", (m) => { if (m.type() === "error") log.push(`[console.error] ${page.url()} :: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => log.push(`[pageerror] ${page.url()} :: ${String(e).slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/")) log.push(`[http ${r.status()}] ${r.url()}`); });
  page.on("request", (r) => inflight.set(r, Date.now()));
  page.on("requestfinished", (r) => inflight.delete(r)); page.on("requestfailed", (r) => inflight.delete(r));
  const email = `wt2r2-sweep-${w}-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(3000);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
  const nfl = page.getByRole("button", { name: /^NFL/ }); await nfl.waitFor(); await page.waitForTimeout(1500); await nfl.click();
  await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForURL(/fav=1|\/bets|\/$/, { timeout: 60000 }).catch(() => {});
  console.log("logged in, tier=" + (await (await page.request.get("/api/me")).json()).tier);
  await page.goto("/markets", { waitUntil: "load" }); await page.waitForTimeout(2000);
  const firstM = await page.locator('a[href^="/m/"]').first().getAttribute("href").catch(() => null);
  for (let route of ROUTES) {
    if (route === "/m/__first__") { if (!firstM) continue; route = firstM; }
    if (route === "/check?__second__") { route = null; await page.goto("/?view=flags", { waitUntil: "load" }); await page.waitForTimeout(1500); route = await page.locator("article[data-row]").nth(1).locator('a[href^="/check?"]').getAttribute("href").catch(() => null); if (!route) continue; }
    inflight.clear();
    let idle = "ok";
    try { await page.goto(route, { waitUntil: "load", timeout: 45000 }); await page.waitForLoadState("networkidle", { timeout: 15000 }); }
    catch (e) { idle = "IDLE-TIMEOUT pending=" + JSON.stringify([...inflight.keys()].map((r) => r.method() + " " + r.url().replace(L.BASE, "").slice(0, 100))); }
    await page.waitForTimeout(800);
    const r = await page.evaluate((DISC) => {
      const t = document.body.innerText;
      const cents = (t.match(/[^\n]{0,25}(\d+\s?¢|\bcents?\b|\$0\.\d\d|\b0\.\d\d\b|\b\d+c\b)[^\n]{0,25}/gi) || []).slice(0, 4);
      const small = [];
      for (const el of document.querySelectorAll('a[href], button, [role="button"], select, summary, input[type=checkbox]')) {
        const q = el.getBoundingClientRect(); if (!q.width || !q.height || q.top > innerHeight || q.bottom < 0) continue;
        if (getComputedStyle(el).visibility === "hidden" || el.closest("footer")) continue;
        const p = el.parentElement; const inline = getComputedStyle(el).display === "inline" && p && (p.textContent || "").trim().length > (el.textContent || "").trim().length + 3;
        if ((q.width < 44 || q.height < 44) && !inline && !(innerWidth >= 1024 && el.closest("header"))) small.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 28)} ${Math.round(q.width)}x${Math.round(q.height)}`);
      }
      return { h1: [...document.querySelectorAll("h1")].map((x) => x.innerText).join(" / "), disc: t.includes(DISC), hs: document.documentElement.scrollWidth > innerWidth + 1, cls: +window.__cls.toFixed(4), cents, small: small.slice(0, 8) };
    }, L.DISC);
    console.log(`[${w}] ${route} -> ${page.url().replace(L.BASE, "")} h1="${r.h1}" disc=${r.disc} hscroll=${r.hs} cls=${r.cls} idle=${idle}${r.cents.length ? " CENTS=" + JSON.stringify(r.cents) : ""}${r.small.length ? " SMALL=" + JSON.stringify(r.small) : ""}`);
    const name = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "home";
    await page.screenshot({ path: `${process.env.OUT}/${w}-sweep-${name}.png` });
  }
  console.log("--- LOG\n" + log.join("\n"));
  await b.close();
})();
