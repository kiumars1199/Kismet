const { chromium } = require("playwright");
const L = require("./lib");
(async () => {
  const b = await chromium.launch();
  for (const [w, h, st] of [[390, 844, "state-390-mixed.json"], [1440, 900, "state-1440-zero.json"]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, baseURL: L.BASE, storageState: `${__dirname}/${st}` });
    const page = await ctx.newPage();
    await page.goto("/settings", { waitUntil: "load" }); await page.waitForTimeout(3000);
    const p = page.getByText(/^Favorites: /);
    if (!(await p.count())) { console.log(w, "no favorites line (signed out?)", page.url()); await ctx.close(); continue; }
    await p.evaluate((e) => e.scrollIntoView({ block: "center" })); await page.waitForTimeout(400);
    console.log(w, await p.innerText());
    await page.screenshot({ path: `${L.OUT}/${w}-misc-06-settings-favorites-raw-ids.png` });
    await ctx.close();
  }
  await b.close();
})();
