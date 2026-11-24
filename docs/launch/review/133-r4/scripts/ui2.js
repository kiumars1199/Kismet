const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const P = `${w}-ui2`;
(async () => {
  const { browser, page, log } = await L.start(w, h, "ui2");
  await H.signup(page, `ui2-${w}`, { topics: ["NFL", "Soccer", "College basketball"] });
  await page.goto("/markets?q=texans", { waitUntil: "networkidle" }); await page.waitForTimeout(2000);
  const c = await H.cls(page); await L.audit(page, `${P} markets`);
  const chips = await page.evaluate(() => {
    const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); const gr = g.getBoundingClientRect();
    const save = [...g.querySelectorAll("button")].find((b) => /Save this view/.test(b.textContent)); const sv = [...g.querySelectorAll("button,summary,a")].find((b) => /Saved views/.test(b.textContent));
    const fade = g.querySelector('[data-testid="chips-fade"]'); const fr = fade?.getBoundingClientRect();
    const sr = save.getBoundingClientRect(), vr = sv?.getBoundingClientRect();
    const hidden = [...g.querySelectorAll("button")].filter((b) => { const r = b.getBoundingClientRect(); return r.right > gr.right + 1 || r.left < gr.left - 1; }).map((b) => b.textContent.trim().slice(0, 16));
    // what is under each visible chip's center (covered by the sticky pin?)
    const covered = [...g.querySelectorAll("button")].filter((b) => { const r = b.getBoundingClientRect(); if (r.right < gr.left || r.left > gr.right) return false; const x = Math.min(r.left + r.width / 2, gr.right - 2); const top = document.elementFromPoint(x, r.top + r.height / 2); return top && !b.contains(top); }).map((b) => b.textContent.trim().slice(0, 16));
    return { row: [Math.round(gr.left), Math.round(gr.right)], sw: g.scrollWidth, cw: g.clientWidth, save: [Math.round(sr.left), Math.round(sr.right)], saved: vr && [Math.round(vr.left), Math.round(vr.right)], fade: fr ? [Math.round(fr.left), Math.round(fr.right), getComputedStyle(fade).display] : null, offRow: hidden, coveredCenters: covered, docSW: document.documentElement.scrollWidth, iw: innerWidth };
  });
  console.log(`[${w}] /markets?q=texans CLS=${c.cls} ${JSON.stringify(c.sh.map((s) => s.v))} chips=${JSON.stringify(chips)}`);
  await L.shot(page, P, "markets-texans");
  // scroll the chip row to its end and back
  await page.evaluate(() => { const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); g.scrollLeft = 9999; });
  await page.waitForTimeout(300); await L.shot(page, P, "chips-scrolled-end");
  const endFade = await page.evaluate(() => !!document.querySelector('[data-testid="chips-fade"]'));
  console.log(`[${w}] fade still shown at scroll end: ${endFade}`);
  await page.evaluate(() => { const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); g.scrollLeft = 0; });
  // keyboard: tab from the first chip until Save this view
  await page.locator('[role="group"][aria-label="Quick filters"] button', { hasText: "NFL" }).first().focus();
  const seq = [];
  for (let i = 0; i < 25; i++) { await page.keyboard.press("Tab"); const f = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { t: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 18), vis: r.left >= 0 && r.right <= innerWidth && r.width > 0 }; }); seq.push(`${f.t}${f.vis ? "" : "(OFFSCREEN)"}`); if (/Saved views/.test(f.t)) break; }
  console.log(`[${w}] tab order: ${seq.join(" > ")}`);
  await L.shot(page, P, "tab-saved-views");
  // column menu
  for (const sc of [0, 600]) {
    await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    await page.evaluate((y) => scrollTo(0, y), sc); await page.waitForTimeout(400);
    const sum = page.locator('summary[title="Choose columns"]'); await sum.click(); await page.waitForTimeout(500);
    const m = await page.evaluate(() => { const s = document.querySelector('summary[title="Choose columns"]'); const d = s.parentElement.querySelector("div"); const r = d.getBoundingClientRect(), b = s.getBoundingClientRect(); const hdr = document.querySelector("header")?.getBoundingClientRect(); return { menu: [Math.round(r.top), Math.round(r.bottom)], btn: [Math.round(b.top), Math.round(b.bottom)], covers: r.bottom > b.top && r.top < b.bottom, ih: innerHeight, headerBottom: hdr && Math.round(hdr.bottom), underHeader: hdr ? r.top < hdr.bottom : false, sh: d.scrollHeight, ch: d.clientHeight, sy: Math.round(scrollY) }; });
    await L.shot(page, P, `colmenu-${sc}`);
    const boxes = page.locator('summary[title="Choose columns"] + div input[type=checkbox]'); const n = await boxes.count(); let ok = 0;
    for (let i = 0; i < n; i++) { const b = boxes.nth(i); await b.scrollIntoViewIfNeeded(); const pre = await b.isChecked(); await b.click(); if ((await b.isChecked()) !== pre) ok++; await b.click(); }
    const sy2 = await page.evaluate(() => Math.round(scrollY));
    console.log(`[${w}] colmenu scroll=${sc}: ${JSON.stringify(m)} toggled ${ok}/${n} pageScrollAfter=${sy2}`);
    await page.keyboard.press("Escape");
  }
  console.log("--- LOG\n" + log.join("\n")); await browser.close();
})();
