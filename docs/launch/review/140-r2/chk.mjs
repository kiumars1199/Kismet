import { launch, base, out, L, init, signIn, facts, delta } from "./lib.mjs";
const b = await launch();
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, extraHTTPHeaders: { "x-e2e-device": `r140-chk-${w}-${Date.now()}` } });
  await ctx.addInitScript(init); const p = await ctx.newPage(); p.setDefaultTimeout(30000);
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await signIn(p, "premium", `r140-chk-${w}-${Date.now()}@example.com`);
  const api = await (await p.request.get(`${base}/api/combos?pays=2`)).json();
  await p.goto(base + "/combos", { waitUntil: "load" }); await p.waitForTimeout(1500);
  for (const k of [0, 3]) {
    const c = api.groups.flatMap((g) => g.combos)[k];
    const card = p.locator("[data-testid=combo-card]").nth(k);
    await card.scrollIntoViewIfNeeded();
    const cardTxt = (await card.innerText()).replace(/\s+/g, " ");
    await delta(p, `${w} Build this combo #${k}`, () => card.getByRole("button", { name: /Build this combo/ }).click(), 1200);
    const tray = (await p.getByTestId("combo-tray").innerText().catch(() => "NO TRAY")).replace(/\s+/g, " ");
    const legs = c.items.map((l) => `${l.market_id}:${l.side_index}`).join(",");
    L(`${w} card#${k} "${cardTxt.slice(0, 110)}"\n   tray "${tray.slice(0, 120)}"`);
    await p.goto(`${base}/check/combo?legs=${encodeURIComponent(legs)}`, { waitUntil: "load" }); await p.waitForTimeout(2000);
    const btn = p.getByTestId("combo-check-btn");
    await delta(p, `${w} Check this combo #${k}`, async () => { await btn.click(); await p.getByTestId("combo-mult").waitFor({ timeout: 30000 }).catch(() => {}); }, 1500);
    const r = await p.evaluate(() => Object.fromEntries(["combo-chance", "combo-mult", "combo-edge", "combo-score"].map((id) => [id, document.querySelector(`[data-testid=${id}]`)?.innerText.replace(/\s+/g, " ")])));
    const f = await facts(p);
    L(`   checker ${JSON.stringify(r)} cls ${f.cls} disc ${f.disc} cents ${f.cents} hs ${f.hs}; tray still "${(await p.getByTestId("combo-tray").innerText().catch(() => "NO TRAY")).replace(/\s+/g, " ").slice(0, 60)}"`);
    if (k === 0) await p.screenshot({ path: `${out}/check-this-combo-${w}.png` });
    await p.goto(base + "/combos", { waitUntil: "load" }); await p.waitForTimeout(1500);
  }
  L(`errors ${JSON.stringify(errs)}`);
  await ctx.close();
}
await b.close();
