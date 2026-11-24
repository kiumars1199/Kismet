// T-wt2j r2 failure scenarios. args: <WxH> <scenario>   scenarios: two | hang | hangfail | retap | long
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const sc = process.argv[3];
(async () => {
  const { browser, page, log } = await L.start(w, h, "err2-" + sc);
  const P = `[${w} ${sc}]`; const out = (s) => console.log(`${P} ${s}`);
  try {
    await H.signup(page, `err2-${sc}-${w}`, { topics: ["NFL"] });
    const me = await (await page.request.get("/api/me")).json();
    const server = async () => (await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json())[0].favorite_topics;
    const cookie = async () => decodeURIComponent(((await page.context().cookies()).find((c) => c.name === "me_topics") || {}).value || "-").split("|")[1];
    // plan: per PATCH number -> {delay, status}
    const plan = { two: { 1: [300, 500], 2: [300, 500] }, hang: { 1: [300, 500], 2: [20000, 200] }, hangfail: { 1: [300, 500], 2: [20000, 500] }, retap: { 1: [300, 500] }, long: { 1: [+(process.env.LD || 300), 500] } }[sc];
    let k = 0; const t0 = Date.now(); const ev = [];
    await page.route("**/api/data/profile", async (r) => {
      if (r.request().method() !== "PATCH") return r.continue();
      const i = ++k; const [d, st] = plan[i] || [300, 200]; const b = (r.request().postDataJSON() || {}).favorite_topics;
      ev.push(`${Date.now() - t0}ms PATCH#${i} ${st === 500 ? "->500" : "->ok"} after ${d}ms ${JSON.stringify(b)}`);
      await new Promise((x) => setTimeout(x, d));
      if (st === 500) return r.fulfill({ status: 500, contentType: "application/json", body: "{}" }).catch(() => {});
      return r.continue().catch(() => {});
    });
    await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(1500);
    const picker = page.getByTestId("topics-picker"); const tiles = picker.locator("button");
    const names = (await tiles.allInnerTexts()).map((x) => x.split("\n")[0]);
    const pressed = () => picker.locator('button[aria-pressed="true"]').allInnerTexts().then((a) => a.map((x) => x.split("\n")[0]));
    const st = () => picker.locator("p").first().innerText();
    const sh = async () => { const r = await picker.locator("p").first().boundingBox(); return Math.round(r.height); };
    const tap = async (i) => { const t = tiles.nth(i); await t.evaluate((e) => e.scrollIntoView({ block: "center" })); await page.waitForTimeout(50); const b = await t.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
    await picker.locator("p").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const cls0 = await page.evaluate(() => window.__cls); const h0 = await sh();
    const clsNow = async () => (await page.evaluate(() => window.__cls) - cls0).toFixed(4);
    const snap = async (lbl) => out(`${lbl}: UI=${JSON.stringify(await pressed())} status="${await st()}" statusH=${await sh()}(was ${h0}) cls=${await clsNow()} server=${JSON.stringify(await server())} cookie=${await cookie()}`);
    if (sc === "two") {
      await tap(7); await tap(8); await tap(9); out(`tapped ${names[7]}, ${names[8]}, ${names[9]} at once; UI=${JSON.stringify(await pressed())}`);
      await page.waitForTimeout(1500); await snap("after both fail");
      await tap(5); await page.waitForTimeout(1200); await snap(`then tap ${names[5]}`);
    } else if (sc === "hang" || sc === "hangfail") {
      await tap(7); await page.waitForTimeout(80); await tap(8); out(`tapped ${names[7]}, ${names[8]}; #1 fails, #2 hangs 20 s`);
      await page.waitForTimeout(1200); await snap("during hang (t~1.5s)");
      await tap(9); await page.waitForTimeout(500); await snap(`tap ${names[9]} during hang`);
      await page.waitForTimeout(6000); await snap("during hang (t~8s)");
      await page.waitForTimeout(16000); await snap("after hang resolves (+2s)");
      await page.waitForTimeout(6000); await snap("+6s later");
      await tap(4); await page.waitForTimeout(1500); await snap(`then tap ${names[4]}`);
    } else if (sc === "retap") {
      await tap(7); await page.waitForTimeout(900); await snap(`after ${names[7]} fails`);
      await tap(7); await page.waitForTimeout(80); out(`re-tap ${names[7]}: status right after="${await st()}"`); await page.waitForTimeout(1200); await snap("after re-tap saves");
    } else if (sc === "long") {
      await tap(+(process.env.IDX || 3)); await page.waitForTimeout(600 + +(process.env.LD || 300)); await snap(`after ${names[+(process.env.IDX || 3)]} fails`);
      await page.waitForTimeout(5000); await snap("+5s");
    }
    out(ev.join(" | "));
    if (process.env.OUT) await page.screenshot({ path: `${process.env.OUT}/${w}-${sc}.png` });
  } catch (e) { out("ERR " + e.message.split("\n")[0] + " url=" + page.url()); }
  console.log(log.filter((l) => !/429|preload|status of 500|http 500/.test(l)).join("\n")); await browser.close();
})();
