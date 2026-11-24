const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number);
(async () => {
  const { browser, page } = await L.start(w, h, "tabtime");
  await H.signup(page, `tabt-${w}`, { topics: ["NFL", "Soccer", "College basketball"] });
  await page.goto("/markets?q=texans", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); });
  console.log(`[${w}] scroll-behavior row=${await page.evaluate(() => getComputedStyle(__g).scrollBehavior)} html=${await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)} reducedMotion=${await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)}`);
  await page.evaluate(() => __g.querySelector("button").focus());
  for (let i = 0; i < 13; i++) {
    await page.keyboard.press("Tab");
    const samples = await page.evaluate(async () => { const out = []; const t0 = performance.now(); for (const ms of [0, 30, 80, 150, 300, 600]) { while (performance.now() - t0 < ms) await new Promise((r) => requestAnimationFrame(r)); const a = document.activeElement; const r = a.getBoundingClientRect(); const pin = [...__g.children].pop(); const pl = getComputedStyle(pin).position === "sticky" && !pin.contains(a) ? pin.getBoundingClientRect().left : Math.min(__g.getBoundingClientRect().right, innerWidth); out.push(`${ms}ms sl=${Math.round(__g.scrollLeft)} vis=${Math.max(0, Math.round(Math.min(r.right, pl) - Math.max(r.left, 0)))}/${Math.round(r.width)}`); } return { t: document.activeElement.textContent.trim().slice(0, 14), out }; });
    console.log(`[${w}] ${samples.t}: ${samples.out.join(" | ")}`);
  }
  await browser.close();
})().catch((e) => console.log("ERR " + e.stack));
