const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number);
(async () => {
  const { browser, page } = await L.start(w, h, "openhdr");
  await H.signup(page, `oh-${w}`, { topics: ["NFL", "Soccer"] });
  await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  const hdr = await page.evaluate(() => { const x = document.querySelector("header"); return { pos: getComputedStyle(x).position, h: Math.round(x.getBoundingClientRect().height) }; });
  const topAbs = await page.evaluate(() => document.querySelector('button[title="Choose columns"]').getBoundingClientRect().top + scrollY);
  for (const btnTop of [30, 10, -10]) {
    await page.evaluate((y) => scrollTo(0, y), topAbs - btnTop); await page.waitForTimeout(250);
    const b = await page.locator('button[title="Choose columns"]').boundingBox();
    const vis = await page.evaluate(() => { const b = document.querySelector('button[title="Choose columns"]').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, Math.max(1, (Math.max(0, b.top) + b.bottom) / 2)); return !!(e && e.closest('button[title="Choose columns"]')); });
    await page.mouse.click(b.x + b.width / 2, Math.max(1, (Math.max(0, b.y) + b.y + b.height) / 2)); await page.waitForTimeout(300);
    const open = await page.locator('[data-testid="column-menu"]').count();
    console.log(`[${w}] header ${JSON.stringify(hdr)} button at y ${Math.round(b.y)}..${Math.round(b.y + b.height)} visible=${vis}: click -> menu open=${!!open} expanded=${await page.locator('button[title="Choose columns"]').getAttribute("aria-expanded")}`);
    if (!open && vis) await L.shot(page, `${w}-openhdr`, `btn${btnTop}`);
    if (open) await page.keyboard.press("Escape");
  }
  await browser.close();
})().catch((e) => console.log("ERR " + e.stack));
