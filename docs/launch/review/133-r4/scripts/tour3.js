const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, baseURL: "http://localhost:3893", storageState: process.argv[2] });
  const page = await ctx.newPage();
  await page.goto("/?view=flags&t=sports.ncaab&fav=1&tour=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const dlg = page.locator('[role="dialog"][aria-labelledby="tour-h"]');
  for (let i = 0; i < 3; i++) { await dlg.getByRole("button", { name: "Next" }).click(); await page.waitForTimeout(900); }
  console.log(await page.evaluate(() => {
    const ring = document.querySelector('[data-testid="tour"] .ring-2');
    const r = ring && ring.getBoundingClientRect();
    const saves = [...document.querySelectorAll('article[data-row] button[aria-label="Save"]')].slice(0,2).map(e => { const q = e.getBoundingClientRect(); return [Math.round(q.top), q.width, q.height]; });
    const wl = [...document.querySelectorAll('a[href="/watchlist"]')].map(e => { const q = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(q.top), q.width, q.height, getComputedStyle(e).zIndex]; });
    const tab = document.querySelector('nav[aria-label] a[href="/watchlist"]')?.closest("nav");
    return JSON.stringify({ scrollY, ring: r && [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)], saves, wl, tabZ: tab && getComputedStyle(tab).zIndex });
  }));
  await b.close();
})();
