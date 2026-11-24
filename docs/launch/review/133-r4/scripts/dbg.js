const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, baseURL: "http://localhost:3893", storageState: process.argv[2] });
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  console.log(page.url());
  console.log(await page.evaluate(() => { const a = document.querySelector("article[data-row]"); return a ? [...a.querySelectorAll("a,button")].map(e => e.tagName + ":" + (e.getAttribute("aria-label")||e.textContent).trim().slice(0,30) + ":" + e.getAttribute("href")).join(" | ") : "no article: " + document.body.innerText.slice(0, 500); }));
  await b.close();
})();
