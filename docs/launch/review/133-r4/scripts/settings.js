const { chromium } = require("playwright");
const L = require("./lib");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, baseURL: L.BASE, storageState: `${__dirname}/state-390-zero.json` });
  const page = await ctx.newPage();
  const log = []; page.on("console", (m) => { if (m.type() === "error") log.push(m.text().slice(0, 200)); });
  await page.goto("/settings", { waitUntil: "load" }); await page.waitForTimeout(3000);
  const t = await page.locator("main").innerText();
  const i = t.search(/topic/i);
  console.log(t.replace(/(Africa|America|Antarctica|Asia|Atlantic|Australia|Europe|Indian|Pacific|Arctic|Etc)\/[^\n]*\n/g, "").replace(/\n+/g, " | ").slice(1100, 4000));
  const sec = page.getByTestId("topics-picker");
  if (await sec.count()) { await sec.first().scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await page.screenshot({ path: `${L.OUT}/390-misc-05-settings-topics.png` });
    console.log("pressed:", await sec.locator("button[aria-pressed=true]").allInnerTexts()); }
  console.log(log.join("\n"));
  await b.close();
})();
