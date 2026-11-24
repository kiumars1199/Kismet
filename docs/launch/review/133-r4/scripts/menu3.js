const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const P = `${w}x${h}-menu`;
const probe = (page) => page.evaluate(() => {
  const s = document.querySelector('summary[title="Choose columns"]'); const det = s.parentElement; const d = det.querySelector(":scope > div");
  const r = d.getBoundingClientRect(), b = s.getBoundingClientRect();
  const boxes = [...d.querySelectorAll("input[type=checkbox]")];
  let hit = 0, vis = 0;
  for (const x of boxes) { const q = x.getBoundingClientRect(); if (q.bottom < r.top || q.top > r.bottom) continue; vis++; const el = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); if (el && d.contains(el)) hit++; }
  const mc = document.elementFromPoint(r.left + 20, Math.min(r.top + 20, innerHeight - 2)); 
  let clip = null; for (let p = det.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) { const pr = p.getBoundingClientRect(); clip = { tag: p.tagName, cls: String(p.className).slice(0, 40), top: Math.round(pr.top), bottom: Math.round(pr.bottom), ox: cs.overflowX, oy: cs.overflowY }; break; } }
  return { open: det.open, menu: [Math.round(r.top), Math.round(r.bottom)], btn: [Math.round(b.top), Math.round(b.bottom)], ih: innerHeight, fits: r.top >= 64 && r.bottom <= innerHeight, covers: r.bottom > b.top + 1 && r.top < b.bottom - 1, visibleRows: vis, hittable: hit, topLeftHitsMenu: !!(mc && d.contains(mc)), clipAncestor: clip, sy: Math.round(scrollY) };
});
(async () => {
  const { browser, page } = await L.start(w, h, "menu3");
  await H.signup(page, `menu3-${w}`, { topics: ["NFL", "Soccer", "College basketball"] });
  const sum = () => page.locator('summary[title="Choose columns"]');
  // a) right after load
  for (let i = 0; i < 3; i++) {
    await page.goto("/markets", { waitUntil: "domcontentloaded" }); await sum().waitFor(); await sum().click();
    const a0 = await probe(page); await page.waitForTimeout(800); const a1 = await probe(page);
    console.log(`[${P}] right-after-load #${i}: at click ${JSON.stringify(a0)}\n      +800ms ${JSON.stringify(a1)}`);
    if (i === 0) await L.shot(page, P, "after-load");
  }
  // b) fast scroll then click immediately
  await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const y of [150, 300, 450, 600, 900, 1400, Math.min(maxY, 3000)]) {
    await page.evaluate(() => { const d = document.querySelector('summary[title="Choose columns"]').parentElement; d.open = false; });
    await page.evaluate((y) => scrollTo(0, y), y);
    const vis = await page.evaluate(() => { const b = document.querySelector('summary[title="Choose columns"]').getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; });
    if (!vis) { console.log(`[${P}] scroll ${y}: button off screen`); continue; }
    await sum().click({ force: true });
    const r = await probe(page); console.log(`[${P}] fast-scroll ${y} then click: ${JSON.stringify(r)}`);
    if (!r.fits || r.covers || r.hittable < r.visibleRows) await L.shot(page, P, `bad-scroll-${y}`);
  }
  // c) open, then scroll while open
  await page.evaluate(() => { document.querySelector('summary[title="Choose columns"]').parentElement.open = false; scrollTo(0, 0); }); await page.waitForTimeout(300);
  await sum().click(); 
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); const r = await probe(page); console.log(`[${P}] while-scrolling step ${i}: ${JSON.stringify(r)}`); }
  await L.shot(page, P, "while-scrolling");
  await browser.close();
})().catch((e) => console.log("ERR " + e.message.split("\n")[0]));
