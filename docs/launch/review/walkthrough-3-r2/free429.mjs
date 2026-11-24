import { launch, base, out, L, init, signIn } from "./lib.mjs";
const b = await launch();
for (const w of [390, 1440]) {
const ctx = await b.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, extraHTTPHeaders: { "x-e2e-device": `wt3r2-f429-${Date.now()}` } });
await ctx.addInitScript(init);
const p = await ctx.newPage(); p.setDefaultTimeout(30000);
p.on("response", (r) => { if (/\/api\/check\/combo/.test(r.url())) L(`    < ${r.status()} /api/check/combo`); });
await signIn(p, "free", `wt3r2-f429-${Date.now()}@example.com`);
const legs = async () => (await p.getByTestId("combo-leg").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").replace(" ✕", ""));
await p.goto(`${base}/check/combo?legs=${encodeURIComponent("6417673:1,6674485:0")}`); await p.waitForTimeout(2500);
await p.getByTestId("combo-check-btn").click(); await p.waitForTimeout(3000);
L(`@${w} scored: ${JSON.stringify(await legs())}`);
await p.locator("#combo-q").fill("Miami"); await p.getByRole("button", { name: "Add", exact: true }).click();
const hits = p.locator('[data-testid="combo-hits"] button'); await hits.first().waitFor();
const i = (await hits.allInnerTexts()).findIndex((t) => /Kent State/.test(t)); await hits.nth(i).click(); await p.waitForTimeout(2500);
L(`  added 3rd: ${JSON.stringify(await legs())} free-note "${await p.getByTestId("combo-free-note").innerText().catch(() => "")}"`);
await p.getByTestId("combo-check-btn").click(); await p.waitForTimeout(3000);
L(`  after 429: ${JSON.stringify(await legs())} box ${JSON.stringify(await p.getByTestId("check-upgrade").innerText().catch(() => null))}`);
await p.screenshot({ path: `${out}/free-${w}-after-429.png` });
await p.reload(); await p.waitForTimeout(3000);
L(`  after reload: ${JSON.stringify(await legs())}`);
await ctx.close();
}
await b.close();
