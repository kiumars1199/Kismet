const L = require("./lib"); const H = require("./h132");
(async () => { const { browser, page } = await L.start(390, 844, "wrap");
  try { await H.signup(page, "wrap", { topics: ["NFL"] }); await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor();
    for (const w of [390, 375, 360]) { await page.setViewportSize({ width: w, height: 844 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const p = document.querySelector('[data-testid="topics-picker"] p'); const labels = [...document.querySelectorAll('[data-testid="topics-picker"] button')].map((b) => b.innerText.split("\n")[0]);
        const orig = p.textContent; const h0 = p.getBoundingClientRect().height; const wraps = [];
        for (const l of labels) { p.textContent = `Couldn't save ${l}. Tap to try again.`; if (p.getBoundingClientRect().height !== h0) wraps.push(l + ":" + p.getBoundingClientRect().height); }
        p.textContent = "Couldn't save 12 topics. Tap to try again."; const multi = p.getBoundingClientRect().height; p.textContent = orig; return { h0, n: labels.length, wraps, multi }; });
      console.log(`[${w}] normal line h=${r.h0}; ${r.wraps.length}/${r.n} labels change the line height: ${JSON.stringify(r.wraps)}; "12 topics" h=${r.multi}`); }
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); } await browser.close(); })();
