const { chromium } = require("playwright");
const L = require("./lib");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, baseURL: L.BASE, storageState: `${__dirname}/state-390-zero.json` });
  const page = await ctx.newPage();
  await page.goto("/account", { waitUntil: "load" }); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "24 hours" }).click(); await page.waitForTimeout(800);
  const sec = page.locator("section", { hasText: "Take a break" });
  await sec.scrollIntoViewIfNeeded();
  console.log((await sec.innerText()).replace(/\n+/g, " | "));
  console.log(JSON.stringify(await sec.locator("button").evaluateAll((bs) => bs.map((x) => { const r = x.getBoundingClientRect(); return [x.textContent.trim(), Math.round(r.width), Math.round(r.height)]; }))));
  await page.screenshot({ path: `${L.OUT}/390-misc-07-account-pause-picked.png` });
  await b.close();
})();
