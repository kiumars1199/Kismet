const { chromium } = require("playwright");
const L = require("./lib");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, baseURL: L.BASE, storageState: `${__dirname}/state-1440-mixed.json` });
  const page = await ctx.newPage();
  for (const u of ["/bets?fav=1&t=sports.nfl", "/bets?fav=1&t=sports.nfl%2Csports.ncaab", "/bets?t=sports.nfl%2Csports.soccer"]) {
    await page.goto(u, { waitUntil: "load" }); await page.waitForTimeout(3000);
    const bar = await page.getByTestId("bar-sport").inputValue().catch(() => "?");
    const shown = await page.locator('[data-testid="bar-sport"]').evaluate((s) => s.options[s.selectedIndex]?.text).catch(() => "?");
    console.log(u, "| bar:", JSON.stringify(bar), JSON.stringify(shown), "| count:", await page.getByTestId("bar-count").innerText().catch(() => "?"), "| h1:", await page.locator("h1").first().innerText(), "| h2s:", (await page.locator("main h2").allInnerTexts()).slice(0, 3).join(" / "));
  }
  await b.close();
})();
