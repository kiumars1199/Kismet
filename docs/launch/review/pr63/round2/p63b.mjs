import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const base = "http://localhost:3302";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const p of ["%2Fm%2F7077574"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const navs = []; page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs.push(f.url().replace(base, "")); });
  await page.goto(`${base}/state?next=${p}`, { waitUntil: "load" });
  await page.getByTestId("state-select").selectOption("TX");
  await page.waitForTimeout(30000);
  console.log(`next=${p} navs=${JSON.stringify(navs)} final=${page.url().replace(base, "")}`);
  await ctx.close();
}
await browser.close();
