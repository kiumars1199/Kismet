// WT2 final: checker text and input values after #138 (exact prices), Free. args <WxH>
const L = require("./lib"); const H = require("./h132"); const [w, h] = process.argv[2].split("x").map(Number);
(async () => { const { browser, page } = await L.start(w, h, "chk");
  try { await H.signup(page, `chkwt2-${w}`, { topics: ["NFL", "Soccer"] }); await page.goto("/bets", { waitUntil: "load" }); await page.waitForTimeout(1500);
    const href = await page.locator('a[href^="/check?m="]').first().getAttribute("href"); await page.goto(href, { waitUntil: "load" }); await page.waitForTimeout(3000);
    await L.audit(page, `${w} check`); await L.shot(page, `chk-${w}`, true);
    console.log(`[${w}] TEXT: ${(await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 1200)}`);
    console.log(`[${w}] INPUTS: ${JSON.stringify(await page.locator("main input, main select").evaluateAll((a) => a.map((x) => `${x.getAttribute("aria-label") || x.name || x.id}=${x.value}`)))}`);
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); } await browser.close(); })();
