// Measure tour step 1 vs first card, with and without the (fixture-only) stale-data note.
const { chromium } = require("playwright");
const S = "/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/wt2r2-scripts";
(async () => {
  const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
  const state = process.argv[3];
  const url = process.argv[4];
  const b = await chromium.launch();
  for (const hide of [true]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, baseURL: "http://localhost:3893", storageState: `${S}/${state}` });
    const page = await ctx.newPage();
    if (hide) await page.addInitScript(() => { const st = document.createElement("style"); st.textContent = 'p[role="status"].text-warning{display:none!important}'; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
    await page.goto(url + "&tour=1", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="bet-card"], article[data-row]')?.getBoundingClientRect();
      const dlg = document.querySelector('[role="dialog"][aria-labelledby="tour-h"]')?.getBoundingClientRect();
      const h1 = document.querySelector("h1")?.getBoundingClientRect();
      return { scrollY, card: card && [Math.round(card.top), Math.round(card.bottom)], dlg: dlg && [Math.round(dlg.top), Math.round(dlg.bottom)], h1: h1 && [Math.round(h1.top), Math.round(h1.bottom)] };
    });
    console.log(`${w} hideStale=${hide}`, JSON.stringify(r));
    await page.screenshot({ path: `${process.env.OUT}/${w}-tour0-${hide ? "fresh-sim" : "asis"}.png` });
    await ctx.close();
  }
  await b.close();
})();
