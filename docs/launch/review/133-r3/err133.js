const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const delay = +(process.argv[3] || 0); const gap = +(process.argv[4] || 0); const SECOND = process.argv[5] === "second";
(async () => {
  const { browser, page } = await L.start(w, h, "err133");
  try {
    await H.signup(page, `err133-${w}`, { topics: ["NFL"] });
    let fail = 0, npatch = 0; const t0 = Date.now(); const ev = [];
    await page.route("**/api/data/profile", async (r) => {
      if (r.request().method() === "PATCH") {
        const b = (r.request().postDataJSON() || {}).favorite_topics; let willFail; if (SECOND) { npatch++; willFail = npatch === 2 && fail > 0; } else { willFail = fail > 0; if (willFail) fail--; }
        ev.push(`${Date.now() - t0}ms PATCH ${willFail ? "->500" : "->ok"} ${JSON.stringify(b)}`);
        if (delay) await new Promise((x) => setTimeout(x, delay));
        if (willFail) return r.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      return r.continue();
    });
    await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(1500);
    const picker = page.getByTestId("topics-picker"); const tiles = picker.locator("button");
    const pressed = () => picker.locator('button[aria-pressed="true"]').allInnerTexts().then((a) => a.map((x) => x.split("\n")[0]));
    const names = (await tiles.allInnerTexts()).map((x) => x.split("\n")[0]);
    const bs = []; for (const i of [7, 8, 9]) { await tiles.nth(i).scrollIntoViewIfNeeded(); bs.push(await tiles.nth(i).boundingBox()); }
    const cls0 = await page.evaluate(() => window.__cls); fail = +(process.env.FAILS || 1);
    for (const b of (SECOND ? bs : bs.slice(0, 2))) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); if (gap) await page.waitForTimeout(gap); }
    console.log(`[${w} d${delay} gap${gap}] tapped ${names[7]}, ${names[8]} ${SECOND ? ", " + names[9] + " (2nd PATCH fails)" : "(first PATCH fails)"}. UI at once ${JSON.stringify(await pressed())}`);
    await page.waitForTimeout(1500 + delay * 3);
    const st = () => picker.locator("p").first().innerText();
    console.log(`   after: UI ${JSON.stringify(await pressed())} status="${await st()}" clsDuringRevert=${(await page.evaluate(() => window.__cls) - cls0).toFixed(4)} shifts=${JSON.stringify(await page.evaluate(() => window.__shifts.filter((x) => x.v > 0.0005).slice(-3)))}`);
    await page.waitForTimeout(+(process.env.LATER || 5500)); console.log(`   +${process.env.LATER || 5500}ms: UI ${JSON.stringify(await pressed())} status="${await st()}" clsTotal=${(await page.evaluate(() => window.__cls) - cls0).toFixed(4)}`);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    console.log("   " + ev.join("\n   ")); const me = await (await page.request.get("/api/me")).json(); console.log("   server " + JSON.stringify((await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json())[0].favorite_topics) + " cookie " + decodeURIComponent(((await page.context().cookies()).find((c) => c.name === "me_topics") || {}).value || "-"));
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); }
  await browser.close();
})();
