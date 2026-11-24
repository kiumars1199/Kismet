const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number);
(async () => {
  const { browser, page } = await L.start(w, h, "tabboth");
  await H.signup(page, `tabb-${w}`, { topics: (process.env.TOPICS || "NFL,Soccer,College basketball").split(",") });
  await page.goto("/markets?q=texans", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); });
  const m = () => page.evaluate(() => { const a = document.activeElement; if (!__g.contains(a)) return null; const r = a.getBoundingClientRect(), gr = __g.getBoundingClientRect(); const pin = [...__g.children].pop();
    const R = Math.min(r.right, getComputedStyle(pin).position === "sticky" && !pin.contains(a) ? pin.getBoundingClientRect().left : gr.right, innerWidth), Lx = Math.max(r.left, gr.left, 0);
    return { t: a.textContent.trim().slice(0, 18), vis: Math.max(0, Math.round(R - Lx)), w: Math.round(r.width), sl: Math.round(__g.scrollLeft) }; });
  await page.evaluate(() => __g.querySelector("button").focus());
  const fw = [], bw = [];
  for (let i = 0; i < 14; i++) { const f = await m(); if (!f) break; fw.push(`${f.t}${f.vis < f.w - 1 ? ` [${f.vis}/${f.w}px sl=${f.sl}]` : ""}`); await page.keyboard.press("Tab"); await page.waitForTimeout(400); }
  for (let i = 0; i < 14; i++) { await page.keyboard.press("Shift+Tab"); await page.waitForTimeout(400); const f = await m(); if (!f) break; bw.push(`${f.t}${f.vis < f.w - 1 ? ` [${f.vis}/${f.w}px sl=${f.sl}]` : ""}`); if (f.vis < f.w - 1 && f.vis < 0.5 * f.w) await L.shot(page, `${w}-tabboth`, "back-" + f.t.replace(/\W+/g, "_")); }
  console.log(`[${w}] Tab:       ${fw.join(" > ")}`); console.log(`[${w}] Shift+Tab: ${bw.join(" < ")}`);
  await browser.close();
})().catch((e) => console.log("ERR " + e.stack));
