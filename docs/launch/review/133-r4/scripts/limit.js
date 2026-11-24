const { chromium } = require("playwright");
const L = require("./lib");
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, baseURL: L.BASE, storageState: `${__dirname}/state-${w}-zero.json`, extraHTTPHeaders: { "x-e2e-device": "wt2r2-limit-" + w + Date.now() } });
    const page = await ctx.newPage();
    for (const m of ["/check?m=6674485&side=0", "/check?m=6673073&side=1"]) { await page.goto(m, { waitUntil: "load" }); await page.waitForTimeout(4000); }
    const card = await page.evaluate(() => { const p = [...document.querySelectorAll("p")].find((e) => /Free includes 1 bet check a day/.test(e.textContent)); if (!p) return document.querySelector("main").innerText.slice(0, 300); let c = p; while (c && !/rounded/.test(c.className)) c = c.parentElement; const r = c.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), c.className.slice(0, 160), c.parentElement.className.slice(0, 160)]; });
    console.log(w, "limit card top/height/class:", JSON.stringify(card));
    await page.screenshot({ path: `${L.OUT}/${w}-misc-04-check-limit-full.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
})();
