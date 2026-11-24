const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const tier = process.argv[3] || "free"; const P = `${w}-${tier}`;
(async () => {
  const { browser, page, log, ctx } = await L.start(w, h, `ui-${tier}`);
  if (tier !== "anon") {
    // auth email step
    await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1500);
    const r = await H.signup(page, `${tier}-${w}`, { topics: ["NFL", "Soccer", "College basketball"], tier: tier === "free" ? undefined : tier });
    console.log(`[${P}] tier=${r.tier}`);
  }
  // markets
  for (const u of ["/markets", "/markets?q=texans", "/?view=flags&fav=1"]) {
    await page.goto(u, { waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(2000);
    const c = await H.cls(page); await L.audit(page, `${P} ${u}`);
    const bar = await page.evaluate(() => { const s = document.querySelector('[data-testid="bar-sport"] select, select[data-testid="bar-sport"]') || document.querySelector('[data-testid="bar-sport"]'); const sel = s && (s.tagName === "SELECT" ? s : s.querySelector("select")); return sel ? sel.options[sel.selectedIndex]?.text : null; });
    const row = await page.evaluate(() => { const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); if (!g) return null; const r = g.getBoundingClientRect(); const kids = [...g.children].filter((k) => k.getBoundingClientRect().width > 0); const hidden = kids.filter((k) => { const b = k.getBoundingClientRect(); return b.right > r.right + 1 || b.left < r.left - 1; }).map((k) => k.textContent.trim().slice(0, 20)); const cs = getComputedStyle(g); return { h: Math.round(r.height), w: Math.round(r.width), sw: g.scrollWidth, cw: g.clientWidth, overflowX: cs.overflowX, scrollbar: g.offsetHeight - g.clientHeight, mask: cs.maskImage || cs.webkitMaskImage, offRow: hidden, chips: kids.map((k) => k.textContent.trim().slice(0, 18)) }; });
    console.log(`[${P}] ${u} CLS=${c.cls} ${JSON.stringify(c.sh)} bar="${bar}" chips=${JSON.stringify(row)}`);
    await L.shot(page, P, u.replace(/[^a-z0-9]+/gi, "_"));
  }
  if (w >= 1000) {
    // column menu: top, then after scroll
    for (const sc of [0, 600]) {
      await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
      await page.evaluate((y) => scrollTo(0, y), sc); await page.waitForTimeout(500);
      const sum = page.locator('summary[title="Choose columns"]');
      if (!(await sum.count())) { console.log(`[${P}] no column chooser`); break; }
      await sum.scrollIntoViewIfNeeded(); await sum.click(); await page.waitForTimeout(500);
      const m = await page.evaluate(() => { const d = document.querySelector('summary[title="Choose columns"]').parentElement.querySelector("div"); const r = d.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), ih: innerHeight, sh: d.scrollHeight, ch: d.clientHeight, n: d.querySelectorAll("input").length, sy: Math.round(scrollY) }; });
      await L.shot(page, P, `colmenu-scroll${sc}`);
      // reach last checkbox by scrolling inside the menu
      const last = page.locator('summary[title="Choose columns"] + div input[type=checkbox]').last();
      await last.scrollIntoViewIfNeeded(); const lb = await last.boundingBox();
      const before = await last.isChecked(); await last.click(); const after = await last.isChecked();
      const m2 = await page.evaluate(() => ({ sy: Math.round(scrollY) }));
      console.log(`[${P}] colmenu scroll=${sc}: ${JSON.stringify(m)} fits=${m.bottom <= m.ih} last cb y=${lb && Math.round(lb.y)} toggled=${before !== after} scrollYafter=${m2.sy}`);
      // page scroll while open -> remeasured?
      await page.mouse.wheel(0, 300); await page.waitForTimeout(400);
      const m3 = await page.evaluate(() => { const d = document.querySelector('summary[title="Choose columns"]')?.parentElement; if (!d?.open) return "closed"; const r = d.querySelector("div").getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), ih: innerHeight }; });
      console.log(`[${P}] colmenu after wheel: ${JSON.stringify(m3)}`);
    }
  }
  if (tier === "free") {
    await page.goto("/settings", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    const tz = await page.evaluate(() => [...document.querySelectorAll("select")].map((s) => ({ v: s.value, t: s.options[s.selectedIndex]?.text, n: s.options.length, first: s.options[0]?.text })));
    console.log(`[${P}] settings selects ${JSON.stringify(tz)}`); await L.audit(page, `${P} settings`); await L.shot(page, P, "settings");
  }
  console.log("--- LOG\n" + log.filter((l) => !/429/.test(l)).join("\n")); await browser.close();
})();
