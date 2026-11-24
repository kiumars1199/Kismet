// r3: tab hidden/visible mid-save, and network-error retry. args: <WxH> <scenario>
// scenarios: hide | hideSlowFirst | hideStay | hideFail | netOnce | netOnceTapDuring | netTwice
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const sc = process.argv[3];
(async () => {
  const { browser, ctx, page, log } = await L.start(w, h, "vis-" + sc);
  const P = `[${w} ${sc}]`; const out = (s) => console.log(`${P} ${s}`);
  try {
    await H.signup(page, `vis-${sc.toLowerCase()}-${w}`, { topics: ["NFL"] });
    const me = await (await page.request.get("/api/me")).json();
    const server = async () => (await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json())[0].favorite_topics.slice().sort();
    const cookie = async () => (decodeURIComponent(((await ctx.cookies()).find((c) => c.name === "me_topics") || {}).value || "-").split("|")[1] || "").replace("on:", "").split(",").filter(Boolean).sort();
    const plan = { hide: {}, hideSlowFirst: { 1: [1500, 200] }, hideStay: { 1: [1500, 200] }, hideFail: { 1: [600, 500] }, netOnce: { 1: [100, "abort"] }, netOnceTapDuring: { 1: [100, "abort"] }, netTwice: { 1: [100, "abort"], 2: [100, "abort"] } }[sc];
    let k = 0; const t0 = Date.now(); const ev = [];
    await ctx.route("**/api/data/profile", async (r) => {
      if (r.request().method() !== "PATCH") return r.continue();
      const i = ++k; const [d, st] = plan[i] || [300, 200]; const b = (r.request().postDataJSON() || {}).favorite_topics;
      ev.push(`${Date.now() - t0}ms #${i} ${st} d${d} ${JSON.stringify(b)}`);
      await new Promise((x) => setTimeout(x, d));
      ev.push(`${Date.now() - t0}ms #${i} released`);
      if (st === "abort") return r.abort("failed").catch(() => {});
      if (st === 500) return r.fulfill({ status: 500, contentType: "application/json", body: "{}" }).catch(() => {});
      return r.continue().catch(() => {});
    });
    await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(1200);
    const picker = page.getByTestId("topics-picker"); const tiles = picker.locator("button");
    const names = (await tiles.allInnerTexts()).map((x) => x.split("\n")[0]);
    // sample the tiles and status every 50 ms to catch any revert or flicker
    await page.evaluate(() => { window.__ui = []; let last = ""; setInterval(() => { const p = document.querySelector('[data-testid="topics-picker"]'); const s = [...p.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.innerText.split("\n")[0]).join(",") + " | " + p.querySelector("p span:last-child").textContent.slice(0, 40); if (s !== last) { window.__ui.push(`${Math.round(performance.now())}: ${s}`); last = s; } }, 50); });
    const pressed = () => picker.locator('button[aria-pressed="true"]').allInnerTexts().then((a) => a.map((x) => x.split("\n")[0]).sort());
    const st = () => picker.locator("p span:last-child").innerText();
    const tap = async (i) => { const t = tiles.nth(i); await t.evaluate((e) => e.scrollIntoView({ block: "center" })); const b = await t.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
    const setVis = (v) => page.evaluate((v) => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v }); Object.defineProperty(document, "hidden", { configurable: true, get: () => v === "hidden" }); document.dispatchEvent(new Event("visibilitychange")); }, v);
    // try a real tab switch first, to see whether headless reports hidden
    const other = await ctx.newPage(); await other.goto("about:blank"); await other.bringToFront(); await page.waitForTimeout(100);
    const realHidden = await page.evaluate(() => document.visibilityState); await page.bringToFront(); await other.close();
    out(`real tab switch -> page visibilityState=${realHidden} (synthetic visibility used below)`);
    const snap = async (lbl) => out(`${lbl}: UI=${JSON.stringify(await pressed())} status="${await st()}" server=${JSON.stringify(await server())} cookie=${JSON.stringify(await cookie())}`);
    if (sc.startsWith("hide")) {
      await tap(2); await tap(4); await tap(5); out(`tapped ${names[2]}, ${names[4]}, ${names[5]}`);
      await page.waitForTimeout(sc === "hide" ? 50 : 150); await setVis("hidden"); out("hidden");
      await page.waitForTimeout(sc === "hideStay" ? 4000 : 2000); await snap("while hidden");
      if (sc !== "hideStay") { await setVis("visible"); out("visible"); await page.waitForTimeout(2500); await snap("after visible"); }
      else { await setVis("visible"); await page.waitForTimeout(2500); await snap("visible after 4 s hidden"); }
    } else if (sc === "netOnce") {
      await tap(7); await page.waitForTimeout(2000); await snap(`tap ${names[7]}, first PATCH network-fails`);
    } else if (sc === "netOnceTapDuring") {
      await tap(7); await page.waitForTimeout(180); await tap(8); await page.waitForTimeout(60); await tap(9); await page.waitForTimeout(2500); await snap(`tap ${names[7]}; #1 network-fails; tap ${names[8]}, ${names[9]} during retry wait`);
    } else if (sc === "netTwice") {
      await tap(7); await page.waitForTimeout(150); await tap(8); await page.waitForTimeout(2000); await snap(`tap ${names[7]}, ${names[8]}; #1 and #2 network-fail`);
      await page.waitForTimeout(5500); await snap("+5.5 s");
    }
    out("PATCH log: " + ev.join(" | "));
    out("UI timeline: " + (await page.evaluate(() => window.__ui)).join(" ; "));
  } catch (e) { out("ERR " + e.message.split("\n")[0]); }
  console.log(log.filter((l) => !/429|preload/.test(l)).join("\n")); await browser.close();
})();
