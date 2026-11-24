import { launch, base, out, L, init, signIn, facts, small } from "./lib.mjs";
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-e2e-device": `wt3r2-free-${Date.now()}` } });
await ctx.addInitScript(init);
const p = await ctx.newPage(); p.setDefaultTimeout(30000);
p.on("response", (r) => { if (/\/api\/check\/combo/.test(r.url())) L(`    < ${r.status()} /api/check/combo`); });
await signIn(p, "free", `wt3r2-free-${Date.now()}@example.com`);
const legs = async () => (await p.getByTestId("combo-leg").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").replace(" ✕", ""));
const sum = () => p.evaluate(() => (window.__e || []).filter((e) => !e.input).reduce((a, e) => a + e.v, 0));
const go = async (set) => { await p.goto(`${base}/check/combo?legs=${encodeURIComponent(set)}`, { waitUntil: "load" }); await p.waitForTimeout(2500); };
for (const w of [390, 1440]) {
  await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  const A = w === 390 ? "6417673:1,6674485:0" : "6417673:1,6654461:0", B = w === 390 ? "6654461:0,7077574:0" : "7078474:1,7077574:0";
  await go(A);
  L(`\n== free @${w}: pre-check note "${await p.getByTestId("combo-free-note").innerText().catch(() => "(none)")}"; legs ${JSON.stringify(await legs())}`);
  await p.getByTestId("combo-check-btn").click(); await p.waitForTimeout(3000);
  L(`  1st check: legs ${JSON.stringify(await legs())} mult ${await p.locator("[data-testid=combo-check] [data-testid=combo-mult]").innerText().catch(() => null)}`);
  await go(A); await p.getByTestId("combo-check-btn").click(); await p.waitForTimeout(3000);
  L(`  same set again: mult ${await p.locator("[data-testid=combo-check] [data-testid=combo-mult]").innerText().catch(() => null)} upgrade ${JSON.stringify(await p.getByTestId("check-upgrade").innerText().catch(() => null))}`);
  await go(B);
  L(`  set B pre-check note "${await p.getByTestId("combo-free-note").innerText().catch(() => "(none)")}"; legs ${JSON.stringify(await legs())}`);
  const c0 = await sum(); await p.getByTestId("combo-check-btn").click(); await p.waitForTimeout(3000);
  L(`  set B after 429: CLS tap ${((await sum()) - c0).toFixed(4)}; legs ${JSON.stringify(await legs())}; limit box ${JSON.stringify(await p.getByTestId("check-upgrade").innerText().catch(() => null))}`);
  L(`  facts ${JSON.stringify(await facts(p))} small ${JSON.stringify((await small(p)).filter((s) => !/^(inline )?(header|footer)/.test(s)))}`);
  await p.screenshot({ path: `${out}/free-${w}-limit.png` });
}
await b.close();
