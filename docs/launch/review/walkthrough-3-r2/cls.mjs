// restore-on-fresh-mount CLS and "Check this combo" CLS with slow results. WT=.. OUT=.. node cls.mjs <plan> <widths>
import { launch, base, out, L, init, signIn } from "./lib.mjs";
const [plan = "pro", widthsArg = "390,1440"] = process.argv.slice(2);
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-e2e-device": `wt3r2-cls-${Date.now()}` } });
await ctx.addInitScript(init);
const p = await ctx.newPage(); p.setDefaultTimeout(30000); p.setDefaultNavigationTimeout(90000);
await signIn(p, plan, `wt3r2-cls-${plan}-${Date.now()}@example.com`);
let delay = 0;
await p.route("**/api/check/combo", async (r) => { if (delay) await new Promise((res) => setTimeout(res, delay)); await r.continue(); });
const SETS = { two: [["6417673", 1], ["6674485", 0]], three: [["7077574", 0], ["6417673", 1], ["6674485", 0]], four: [["7077574", 0], ["6654461", 0], ["6417673", 1], ["6674485", 0]], fourSame: [["7077574", 0], ["6674492", 0], ["6417673", 1], ["6674485", 0]] };
const entries = () => p.evaluate(() => window.__e);
const sum = (es) => es.filter((e) => !e.input).reduce((a, e) => a + e.v, 0).toFixed(4);
const mult = () => p.locator("[data-testid=combo-check] [data-testid=combo-mult]");
for (const w of widthsArg.split(",").map(Number)) {
  await p.setViewportSize({ width: w, height: w < 1024 ? 844 : 900 });
  for (const [name, set] of Object.entries(SETS)) {
    const legs = set.map(([m, s]) => `${m}:${s}`).join(",");
    // seed this tab's stored legs via the URL, then fresh documents
    await p.goto(`${base}/check/combo?legs=${encodeURIComponent(legs)}`, { waitUntil: "load" }); await p.getByTestId("combo-leg").nth(set.length - 1).waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
    for (const [how, u] of [["url", `/check/combo?legs=${encodeURIComponent(legs)}`], ["bare (tab storage)", "/check/combo"], ["shared check=1", `/check/combo?legs=${encodeURIComponent(legs)}&check=1`]]) {
      if (how === "shared check=1") delay = 900;
      await p.goto(base + u, { waitUntil: "load" }); await p.waitForTimeout(how === "shared check=1" ? 3500 : 2500); delay = 0;
      const es = await entries();
      L(`${w} ${name} fresh mount [${how}]: legs ${await p.getByTestId("combo-leg").count()} result ${await mult().innerText().catch(() => "-")} CLS ${sum(es)} ${JSON.stringify(es.filter((e) => e.v > 0.0005))}`);
      if (name === "four" && how === "url") await p.screenshot({ path: `${out}/cls-${plan}-${w}-restored-4legs.png` });
    }
    for (const d of [0, 700, 1500]) for (const scrolled of [false, true]) {
      await p.goto(`${base}/check/combo?legs=${encodeURIComponent(legs)}`, { waitUntil: "load" }); await p.waitForTimeout(2500);
      const btn = p.getByTestId("combo-check-btn");
      if (scrolled) { await btn.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); }
      const n0 = (await entries()).length; delay = d;
      const t = await p.evaluate(() => performance.now());
      await btn.click();
      await mult().waitFor({ timeout: 30000 }).catch(() => {});
      const t2 = await p.evaluate(() => performance.now());
      await p.waitForTimeout(1500); delay = 0;
      const es = (await entries()).slice(n0);
      L(`  ${w} ${name} check delay ${d} ${scrolled ? "scrolled" : "top"}: result after ${Math.round(t2 - t)}ms counted CLS ${sum(es)} ${JSON.stringify(es.map((e) => ({ ...e, t: e.t - Math.round(t) })))}`);
      if (d === 1500 && name === "four") await p.screenshot({ path: `${out}/cls-${plan}-${w}-four-checked-${scrolled ? "scrolled" : "top"}.png` });
    }
  }
}
await b.close();
