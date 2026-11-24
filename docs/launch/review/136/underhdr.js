const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number);
(async () => {
  const { browser, page } = await L.start(w, h, "underhdr");
  await H.signup(page, `uh-${w}`, { topics: ["NFL", "Soccer"] });
  await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  const topAbs = await page.evaluate(() => document.querySelector('button[title="Choose columns"]').getBoundingClientRect().top + scrollY);
  for (const btnTop of [100, 40, 25, 21, 19, 10, -20, -40, -50]) {
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(150);
    await page.locator('button[title="Choose columns"]').click(); await page.waitForTimeout(150);
    await page.evaluate((y) => scrollTo(0, y), topAbs - btnTop); await page.waitForTimeout(250);
    const r = await page.evaluate(() => { const b = document.querySelector('button[title="Choose columns"]').getBoundingClientRect(); const m = document.querySelector('[data-testid="column-menu"]'); const hd = document.querySelector("body header, header").getBoundingClientRect(); const c = document.elementFromPoint(b.left + b.width / 2, Math.max(1, b.top + b.height / 2)); let visPx = 0; for (let y = Math.max(0, Math.ceil(b.top)); y < Math.min(innerHeight, b.bottom); y++) { const e = document.elementFromPoint(b.left + b.width / 2, y); if (e && e.closest('button[title="Choose columns"]')) visPx++; } return { btn: [Math.round(b.top), Math.round(b.bottom)], topBarBottom: Math.round([...document.querySelectorAll("header")].map((x) => x.getBoundingClientRect()).find((x) => x.top <= 0 && x.bottom > 0)?.bottom ?? -1), btnCenterIsBtn: !!(c && c.closest('button[title="Choose columns"]')), visPx, menu: m ? Math.round(m.getBoundingClientRect().top) : null }; });
    console.log(`[${w}] button top ${btnTop}: ${JSON.stringify(r)} ${r.menu !== null && r.visPx === 0 ? "<- BAD: MENU OPEN, BUTTON HIDDEN" : r.menu === null && r.visPx > 0 ? "<- closed while " + r.visPx + "px of button visible" : "ok"}`);
    if ((r.menu !== null) !== (r.visPx > 0)) await L.shot(page, `${w}-underhdr`, `btn${btnTop}`);
    await page.keyboard.press("Escape");
  }
  await browser.close();
})().catch((e) => console.log("ERR " + e.stack));
