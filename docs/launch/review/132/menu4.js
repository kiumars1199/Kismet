// Round 3: column menu is a fixed panel portaled to <body> (data-testid="column-menu"), trigger button[title="Choose columns"].
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const P = `${w}x${h}-menu${process.env.TIER ? "-" + process.env.TIER : ""}`;
const BTN = 'button[title="Choose columns"]', MENU = '[data-testid="column-menu"]';
const fails = [];
const probe = (page) => page.evaluate(({ BTN, MENU }) => {
  const b = document.querySelector(BTN); const d = document.querySelector(MENU);
  if (!d) return { open: false, btn: b && [Math.round(b.getBoundingClientRect().top), Math.round(b.getBoundingClientRect().bottom)], sy: Math.round(scrollY) };
  const r = d.getBoundingClientRect(), br = b.getBoundingClientRect();
  const hdr = document.querySelector("body > header, header")?.getBoundingClientRect();
  const boxes = [...d.querySelectorAll("input[type=checkbox]")];
  const st0 = d.scrollTop; let hit = 0; const miss = [];
  for (const x of boxes) {
    x.scrollIntoView({ block: "nearest" });                     // scrolls only the panel (it is the nearest scroller; fixed => page cannot move it)
    const q = x.getBoundingClientRect(); const el = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    const lab = x.closest("label"); const lr = lab.getBoundingClientRect();
    if (el === x || (el && lab.contains(el))) hit++; else miss.push(`${lab.textContent.trim().slice(0, 14)}@${Math.round(q.top)}:${el ? el.tagName + "." + String(el.className).slice(0, 30) : "null"}`);
  }
  d.scrollTop = st0;
  const rowH = [...d.querySelectorAll("label")].map((l) => Math.round(l.getBoundingClientRect().height));
  const gap = r.top >= br.bottom - 1 ? Math.round(r.top - br.bottom) : r.bottom <= br.top + 1 ? Math.round(br.top - r.bottom) : "OVERLAP";
  return { open: true, menu: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], btn: [Math.round(br.left), Math.round(br.top), Math.round(br.bottom)], iw: innerWidth, ih: innerHeight,
    hdrBottom: hdr && Math.round(hdr.bottom), inView: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, underHeader: hdr ? r.top < hdr.bottom - 1 : false,
    n: boxes.length, hittable: hit, miss, gap, minRow: Math.min(...rowH), pos: getComputedStyle(d).position, parent: d.parentElement.tagName, vis: getComputedStyle(d).visibility, sy: Math.round(scrollY), sh: d.scrollHeight, ch: d.clientHeight };
}, { BTN, MENU });
const ok = (r) => r.open && r.inView && !r.underHeader && r.hittable === r.n && r.n > 0 && r.gap !== "OVERLAP" && r.vis === "visible";
function rep(label, r) { const good = ok(r); console.log(`[${P}] ${good ? "OK " : "BAD"} ${label}: ${JSON.stringify(r)}`); if (!good) fails.push(label); return good; }
async function toggleAll(page, label) {
  // real mouse clicks at each checkbox center; then click again to restore
  const n = await page.locator(`${MENU} input[type=checkbox]`).count(); let t = 0; const bad = [];
  for (let i = 0; i < n; i++) {
    const cb = page.locator(`${MENU} input[type=checkbox]`).nth(i);
    if (!(await page.locator(MENU).count())) { bad.push(`menu closed at ${i}`); break; }
    await cb.evaluate((x) => x.scrollIntoView({ block: "nearest" }));
    const bb = await cb.boundingBox(); const pre = await cb.isChecked();
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(80);
    if (!(await page.locator(MENU).count())) { bad.push(`menu closed after click ${i}`); break; }
    const post = await cb.isChecked(); if (post !== pre) t++; else bad.push(`#${i} no toggle`);
    const bb2 = await cb.boundingBox(); await page.mouse.click(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2); await page.waitForTimeout(80);
    if ((await cb.isChecked()) !== pre) bad.push(`#${i} not restored`);
  }
  const after = await probe(page);
  console.log(`[${P}] toggle ${label}: ${t}/${n} ${bad.length ? "BAD " + bad.join(",") : ""} after=${JSON.stringify({ open: after.open, menu: after.menu, btn: after.btn, gap: after.gap, inView: after.inView })}`);
  if (t !== n || bad.length) fails.push(`toggle ${label}`);
}
(async () => {
  const { browser, page, log } = await L.start(w, h, "menu4");
  await H.signup(page, `menu4-${w}`, { topics: ["NFL", "Soccer", "College basketball"], tier: process.env.TIER });
  const btn = () => page.locator(BTN);
  await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  const count = await btn().count(); const vis = count ? await btn().isVisible() : false;
  console.log(`[${P}] chooser buttons=${count} visible=${vis} table=${await page.locator("table").count()} thead=${await page.evaluate(() => Math.round(document.querySelector("thead")?.getBoundingClientRect().height || 0))}`);
  if (!vis) { await L.shot(page, P, "no-chooser"); await L.audit(page, `${P} markets`); console.log(`[${P}] SUMMARY no chooser at this width`); await browser.close(); return; }
  // a) immediately after load (domcontentloaded, click as soon as the button exists) x5
  for (let i = 0; i < 5; i++) {
    await page.goto("/markets", { waitUntil: "domcontentloaded" }); await btn().waitFor(); await btn().click();
    await page.locator(MENU).waitFor({ timeout: 3000 }).catch(() => {});
    rep(`after-load #${i} at click`, await probe(page)); await page.waitForTimeout(800); const r1 = await probe(page); rep(`after-load #${i} +800ms`, r1);
    if (i === 0) { await L.shot(page, P, "after-load"); await toggleAll(page, "after-load"); }
  }
  // b) from the top after settle x5
  for (let i = 0; i < 5; i++) {
    await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(800); await page.evaluate(() => scrollTo(0, 0));
    await btn().click(); await page.waitForTimeout(100); const r = await probe(page); rep(`top #${i}`, r);
    if (i === 0) { await L.shot(page, P, "top"); await toggleAll(page, "top"); }
    await page.keyboard.press("Escape");
  }
  // c) after scrolling to 5 positions (button on screen) -> open
  const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const btnY = await page.evaluate((BTN) => document.querySelector(BTN).getBoundingClientRect().top + scrollY, BTN);
  const ys = [btnY - h + 60, btnY - h / 2, btnY - 200, btnY - 90, Math.max(0, btnY - 75)].map((y) => Math.max(0, Math.min(maxY, Math.round(y))));
  for (const [i, y] of ys.entries()) {
    await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(150);
    const onScreen = await page.evaluate((BTN) => { const b = document.querySelector(BTN).getBoundingClientRect(); const hb = document.querySelector("header")?.getBoundingClientRect().bottom || 0; return b.top >= hb && b.bottom <= innerHeight; }, BTN);
    if (!onScreen) { console.log(`[${P}] scrolled ${y}: button not on screen`); continue; }
    await btn().click(); await page.waitForTimeout(100); const r = await probe(page); rep(`scrolled y=${y} #${i}`, r);
    if (i === 0 || i === 2) { await L.shot(page, P, `scrolled-${y}`); await toggleAll(page, `scrolled-${y}`); }
    await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  }
  // d) open from the top, then scroll the PAGE while open (wheel)
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  await btn().click(); await page.waitForTimeout(100);
  const r0 = await probe(page); const mm = r0.menu; await page.mouse.move(Math.max(5, mm[0] - 40 > 5 ? mm[0] - 40 : mm[2] + 40), 300);
  // wheel away from the menu so the page (not the panel) scrolls
  await page.mouse.move(w - 20, Math.round(h / 2));
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(80); const r = await probe(page); console.log(`[${P}] page-wheel step ${i}: open=${r.open} menu=${JSON.stringify(r.menu)} btn=${JSON.stringify(r.btn)} gap=${r.gap} inView=${r.inView} underHeader=${r.underHeader} sy=${r.sy}`); if (i === 3 || i === 11) await L.shot(page, P, `page-wheel-${i}`); }
  // wheel inside the panel: does the page scroll (overscroll-contain)?
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  if (!(await page.locator(MENU).count())) { await btn().click(); await page.waitForTimeout(100); }
  const rr = await probe(page);
  if (rr.open) { const sy0 = rr.sy; await page.mouse.move((rr.menu[0] + rr.menu[2]) / 2, (rr.menu[1] + rr.menu[3]) / 2); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(80); } const r2 = await probe(page); console.log(`[${P}] wheel inside panel: page sy ${sy0}->${r2.sy} panelScrollable=${rr.sh > rr.ch}`); }
  // e) scroll the TABLE box horizontally while open
  await page.keyboard.press("Escape"); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  await btn().click(); await page.waitForTimeout(100);
  const box = await page.evaluate((BTN) => { let p = document.querySelector(BTN).parentElement; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowX)) p = p.parentElement; return p ? { sw: p.scrollWidth, cw: p.clientWidth } : null; }, BTN);
  console.log(`[${P}] table scroll box: ${JSON.stringify(box)}`);
  if (box && box.sw > box.cw) {
    for (const x of [100, 300, 9999]) {
      await page.evaluate(({ BTN, x }) => { let p = document.querySelector(BTN).parentElement; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowX)) p = p.parentElement; p.scrollLeft = x; }, { BTN, x }); await page.waitForTimeout(150);
      const r = await probe(page); console.log(`[${P}] table scrollLeft=${x}: open=${r.open} menu=${JSON.stringify(r.menu)} btn=${JSON.stringify(r.btn)} gap=${r.gap} inView=${r.inView}`);
    }
    await L.shot(page, P, "table-hscroll");
    await page.evaluate((BTN) => { let p = document.querySelector(BTN).parentElement; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowX)) p = p.parentElement; p.scrollLeft = 0; }, BTN);
  }
  // f) Escape, outside click, button toggle, keyboard
  if (!(await page.locator(MENU).count())) { await btn().click(); await page.waitForTimeout(100); }
  await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  const escClosed = !(await page.locator(MENU).count()); const escFocus = await page.evaluate((BTN) => document.activeElement === document.querySelector(BTN), BTN);
  await btn().click(); await page.waitForTimeout(100); await page.mouse.click(w - 10, h - 10); await page.waitForTimeout(100);
  const outClosed = !(await page.locator(MENU).count());
  await btn().click(); await page.waitForTimeout(100); await btn().click(); await page.waitForTimeout(100);
  const btnToggleClosed = !(await page.locator(MENU).count());
  // click a table header sort button while open: closes + does the sort fire?
  console.log(`[${P}] escape closes=${escClosed} focusBack=${escFocus} outsideClick closes=${outClosed} button-toggle closes=${btnToggleClosed}`);
  if (!escClosed || !escFocus || !outClosed || !btnToggleClosed) fails.push("close behaviour");
  // keyboard: focus button, Enter opens -> where is focus; Space toggles first; Tab through; Tab past last; Shift+Tab from first
  await btn().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  const af = () => page.evaluate((MENU) => { const a = document.activeElement; const m = document.querySelector(MENU); return { tag: a.tagName, txt: (a.closest("label")?.textContent || a.textContent || a.getAttribute("title") || "").trim().slice(0, 20), inMenu: !!(m && m.contains(a)), open: !!m, expanded: document.querySelector('button[title="Choose columns"]').getAttribute("aria-expanded") }; }, MENU);
  const k0 = await af();
  const c0 = await page.locator(`${MENU} input`).first().isChecked(); await page.keyboard.press("Space"); await page.waitForTimeout(80); const c1 = await page.locator(`${MENU} input`).first().isChecked(); await page.keyboard.press("Space");
  const seq = [];
  const n = await page.locator(`${MENU} input`).count();
  for (let i = 0; i < n + 2; i++) { await page.keyboard.press("Tab"); seq.push(await af()); }
  console.log(`[${P}] keyboard: Enter -> ${JSON.stringify(k0)}; Space toggles first=${c0 !== c1}; Tab x${n + 2}: ${seq.map((s) => `${s.txt}${s.inMenu ? "" : "(OUT open=" + s.open + ")"}`).join(" > ")}`);
  await page.keyboard.press("Escape"); await btn().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(150);
  await page.keyboard.press("Shift+Tab"); const st = await af();
  console.log(`[${P}] keyboard: Shift+Tab from first -> ${JSON.stringify(st)}`);
  await page.keyboard.press("Escape");
  console.log(`[${P}] SUMMARY fails=${fails.length} ${JSON.stringify(fails)}`);
  console.log("--- LOG\n" + log.filter((l) => !/429/.test(l)).join("\n")); await browser.close();
})().catch((e) => console.log("ERR " + e.stack));
