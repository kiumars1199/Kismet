const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, baseURL: "http://localhost:3893", storageState: process.argv[2] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { const st = document.createElement("style"); st.textContent = '.text-warning[role="status"]{display:none!important}'; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
  await page.goto("/?view=flags&t=sports.nfl%2Csports.ncaab&fav=1&tour=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  console.log(await page.evaluate(() => {
    const ban = [...document.querySelectorAll('[role="status"]')].map(e => e.tagName + ":" + getComputedStyle(e).display + ":" + e.className.slice(0,60) + ":" + e.textContent.slice(0,30));
    const card = document.querySelector('article[data-row]').getBoundingClientRect();
    const top5 = [...document.querySelectorAll("h2")].map(h => h.textContent + "@" + Math.round(h.getBoundingClientRect().top));
    return JSON.stringify({ scrollY, ban, card: [card.top, card.bottom], top5 });
  }));
  await b.close();
})();
