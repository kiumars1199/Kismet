// Round 3: chip-row fade at start/end, and Tab focus never hidden (under pinned Save/Saved views chips, or outside the row/viewport).
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const P = `${w}-chips`;
const ROW = () => [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent));
(async () => {
  const { browser, page, log } = await L.start(w, h, "chips3");
  await H.signup(page, `chips3-${w}`, { topics: ["NFL", "Soccer", "College basketball"] });
  for (const url of ["/markets?q=texans", "/markets"]) {
    await page.goto(url, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    const c = await H.cls(page);
    const st = () => page.evaluate((src) => { const ROW = eval(src); const g = ROW(); const cs = getComputedStyle(g); const f = g.querySelector('[data-testid="chips-fade"]'); const fv = f && getComputedStyle(f).display !== "none" ? f.getBoundingClientRect() : null;
      return { sl: Math.round(g.scrollLeft), sw: g.scrollWidth, cw: g.clientWidth, ox: cs.overflowX, wrap: cs.flexWrap, h: Math.round(g.getBoundingClientRect().height), fade: fv ? [Math.round(fv.left), Math.round(fv.right)] : null, spe: g.style.scrollPaddingInlineEnd }; }, ROW.toString());
    const s0 = await st();
    console.log(`[${w}] ${url} CLS=${c.cls} start: ${JSON.stringify(s0)} => fade ${s0.sw > s0.cw ? (s0.fade ? "shown (ok, more to the right)" : "MISSING while chips overflow") : (s0.fade ? "SHOWN without overflow" : "none (no overflow)")}`);
    await L.shot(page, P, `${url.replace(/[^a-z]+/g, "_")}-start`);
    await page.evaluate((src) => { eval(src)().scrollLeft = 99999; }, ROW.toString()); await page.waitForTimeout(250);
    const s1 = await st(); console.log(`[${w}] ${url} end: ${JSON.stringify(s1)} => fade ${s1.fade ? "STILL SHOWN at end" : "hidden (ok)"}`);
    await L.shot(page, P, `${url.replace(/[^a-z]+/g, "_")}-end`);
    // partial: 1px before the end
    await page.evaluate((src) => { const g = eval(src)(); g.scrollLeft = g.scrollWidth - g.clientWidth - 20; }, ROW.toString()); await page.waitForTimeout(250);
    const s2 = await st(); console.log(`[${w}] ${url} 20px-before-end: fade=${!!s2.fade}`);
    await page.evaluate((src) => { eval(src)().scrollLeft = 0; }, ROW.toString()); await page.waitForTimeout(250);
    const s3 = await st(); console.log(`[${w}] ${url} back to start: fade=${!!s3.fade}`);
    // Tab through every control in the row (from just before the row)
    await page.evaluate((src) => { const g = eval(src)(); const b = g.querySelector("button"); b.focus(); }, ROW.toString());
    const seq = []; let bad = 0;
    for (let i = 0; i < 40; i++) {
      const f = await page.evaluate((src) => { const g = eval(src)(); const a = document.activeElement; if (!g.contains(a)) return { out: true, t: (a.textContent || a.getAttribute("aria-label") || a.tagName).trim().slice(0, 20) };
        const r = a.getBoundingClientRect(), gr = g.getBoundingClientRect();
        const inRow = r.left >= gr.left - 1 && r.right <= gr.right + 1, inVp = r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
        const pts = [r.left + 3, r.left + r.width / 2, r.right - 3].map((x) => document.elementFromPoint(x, r.top + r.height / 2));
        const covered = pts.map((e) => !(e && (a === e || a.contains(e))));
        return { t: a.textContent.trim().slice(0, 18), inRow, inVp, covered, sl: Math.round(g.scrollLeft), x: [Math.round(r.left), Math.round(r.right)] }; }, ROW.toString());
      if (f.out) { seq.push(`[left row -> ${f.t}]`); break; }
      const hidden = !f.inRow || !f.inVp || f.covered.some(Boolean);
      if (hidden) bad++;
      seq.push(`${f.t}${hidden ? `(HIDDEN inRow=${f.inRow} inVp=${f.inVp} cov=${f.covered.map((x) => (x ? 1 : 0)).join("")} x=${f.x} sl=${f.sl})` : ""}`);
      if (hidden && bad <= 2) await L.shot(page, P, `tab-hidden-${bad}`);
      await page.keyboard.press("Tab"); await page.waitForTimeout(120);
    }
    console.log(`[${w}] ${url} tab: hidden=${bad} :: ${seq.join(" > ")}`);
    // Shift+Tab back across the row
    const back = []; let bbad = 0;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Shift+Tab"); await page.waitForTimeout(120);
      const f = await page.evaluate((src) => { const g = eval(src)(); const a = document.activeElement; if (!g.contains(a)) return { out: true }; const r = a.getBoundingClientRect(), gr = g.getBoundingClientRect(); const pts = [r.left + 3, r.right - 3].map((x) => document.elementFromPoint(x, r.top + r.height / 2)); return { t: a.textContent.trim().slice(0, 18), hid: r.left < gr.left - 1 || r.right > gr.right + 1 || r.left < 0 || r.right > innerWidth || pts.some((e) => !(e && (a === e || a.contains(e)))) }; }, ROW.toString());
      if (f.out) break; if (f.hid) bbad++; back.push(f.t + (f.hid ? "(HIDDEN)" : ""));
    }
    console.log(`[${w}] ${url} shift-tab: hidden=${bbad} :: ${back.join(" < ")}`);
  }
  console.log("--- LOG\n" + log.filter((l) => !/429/.test(l)).join("\n")); await browser.close();
})().catch((e) => console.log("ERR " + e.stack));
