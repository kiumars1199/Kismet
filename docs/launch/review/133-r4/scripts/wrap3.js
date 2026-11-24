// r3: does any real error text exceed the reserved height? Sets the visible span to each candidate text and compares p height.
const L = require("./lib"); const H = require("./h132");
(async () => { const { browser, page } = await L.start(390, 844, "wrap3");
  try { await H.signup(page, "wrap3", { topics: ["NFL"] }); await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor();
    for (const w of [320, 340, 360, 375, 390, 414, 430, 600, 768, 1024, 1440]) { await page.setViewportSize({ width: w, height: 844 }); await page.waitForTimeout(250);
      const r = await page.evaluate(() => { const p = document.querySelector('[data-testid="topics-picker"] p'); const spans = p.querySelectorAll("span"); const vis = spans[spans.length - 1];
        const labels = [...document.querySelectorAll('[data-testid="topics-picker"] button')].map((b) => b.innerText.split("\n")[0]);
        const orig = vis.textContent; const h0 = p.getBoundingClientRect().height; const over = [];
        const sorted = [...labels].sort((a, b) => b.length - a.length);
        const cands = [...labels.map((l) => `Couldn't save ${l}. Tap it to try again.`), ...labels.flatMap((a) => labels.filter((b) => b !== a).map((b) => `Couldn't save ${a} and ${b}. Tap them to try again.`)),
          `Couldn't save ${sorted[0]}, ${sorted[1]} and 51 more. Tap them to try again.`, `Couldn't save ${sorted[0]}, ${sorted[1]} and 12 more. Tap them to try again.`, "53 chosen. They show first in your quick filters."];
        for (const c of cands) { vis.textContent = c; const hh = p.getBoundingClientRect().height; if (hh > h0 + 0.5) over.push(`${hh}:${c}`); }
        vis.textContent = orig; return { h0, n: cands.length, over: over.slice(0, 3), nOver: over.length }; });
      console.log(`[${w}] reserved h=${r.h0}; ${r.nOver}/${r.n} candidate lines taller than reserve ${JSON.stringify(r.over)}`); }
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); } await browser.close(); })();
