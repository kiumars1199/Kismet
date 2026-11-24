// r4: errorText names up to 3. Candidates: ordered triples of the 16 longest labels, "A, B and N more" (N 2..51) over ordered pairs of the 16 longest, plus wrap3's set.
const L = require("./lib"); const H = require("./h132");
(async () => { const { browser, page } = await L.start(390, 844, "wrap4");
  try { await H.signup(page, "wrap4", { topics: ["NFL"] }); await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor();
    for (const w of [320, 340, 360, 375, 390, 414, 430, 600, 768, 1024, 1440]) { await page.setViewportSize({ width: w, height: 844 }); await page.waitForTimeout(250);
      const r = await page.evaluate(() => { const p = document.querySelector('[data-testid="topics-picker"] p'); const spans = p.querySelectorAll("span"); const vis = spans[spans.length - 1];
        const labels = [...document.querySelectorAll('[data-testid="topics-picker"] button')].map((b) => b.innerText.split("\n")[0]);
        const top = [...new Set(labels)].sort((a, b) => b.length - a.length).slice(0, 16);
        const orig = vis.textContent; const h0 = p.getBoundingClientRect().height; const over = []; const cands = [];
        for (const a of top) for (const b of top) if (b !== a) { for (const c of top) if (c !== a && c !== b) cands.push(`Couldn't save ${a}, ${b} and ${c}. Tap them to try again.`);
          for (let n = 2; n <= 51; n++) cands.push(`Couldn't save ${a}, ${b} and ${n} more. Tap them to try again.`); }
        for (const l of labels) cands.push(`Couldn't save ${l}. Tap it to try again.`);
        for (const c of cands) { vis.textContent = c; const hh = p.getBoundingClientRect().height; if (hh > h0 + 0.5) over.push(`${hh}:${c}`); }
        vis.textContent = orig; return { h0, n: cands.length, over: over.slice(0, 3), nOver: over.length, nLabels: labels.length, spans: spans.length }; });
      console.log(`[${w}] reserved h=${r.h0} labels=${r.nLabels} spans=${r.spans}; ${r.nOver}/${r.n} candidate lines taller than reserve ${JSON.stringify(r.over)}`); }
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); } await browser.close(); })();
