const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number);
(async () => {
  const { browser, page } = await L.start(w, h, "tabsettle");
  await H.signup(page, `tabs-${w}`, { topics: ["NFL", "Soccer", "College basketball"] });
  await page.goto("/markets?q=texans", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  const ROW = '[role="group"][aria-label="Quick filters"]:has(button:text("Save this view"))';
  await page.locator(`${ROW} button`).first().focus();
  for (let i = 0; i < 14; i++) {
    const f = await page.evaluate(() => { const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); const a = document.activeElement; if (!g.contains(a)) return null;
      const pin = [...g.children].pop(); const isPinChild = pin.contains(a); const r = a.getBoundingClientRect(), pr = pin.getBoundingClientRect(), gr = g.getBoundingClientRect();
      const visR = Math.min(r.right, isPinChild ? gr.right : (getComputedStyle(pin).position === "sticky" ? pr.left : gr.right), innerWidth), visL = Math.max(r.left, gr.left, 0);
      return { t: a.textContent.trim().slice(0, 16), x: [Math.round(r.left), Math.round(r.right)], pinLeft: Math.round(pr.left), visiblePx: Math.max(0, Math.round(visR - visL)), widthPx: Math.round(r.width), sl: Math.round(g.scrollLeft) }; });
    if (!f) break;
    if (f.visiblePx < f.widthPx - 1) { console.log(`[${w}] after 700ms: "${f.t}" chip ${f.x} only ${f.visiblePx}/${f.widthPx}px visible (pinned starts ${f.pinLeft}, scrollLeft ${f.sl})`); await L.shot(page, `${w}-tabsettle`, f.t.replace(/\W+/g, "_")); }
    await page.keyboard.press("Tab"); await page.waitForTimeout(700);
  }
  console.log(`[${w}] done`); await browser.close();
})().catch((e) => console.log("ERR " + e.stack));
