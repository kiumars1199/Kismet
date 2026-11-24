// T-wt3e (walk-through 3, round 3): the combo checker with a same-event pair holds still when the score lands, a reloaded scored link
// holds still at 768, and the note says which of the two bets to drop. Fixture data, demo server. Screenshots (deviceScaleFactor 1)
// go to docs/launch/review/wt3e/ when WT3E_SHOTS=1.
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

type Row = { market: { id: string; event_id: string }; side: { side_index: number } };
const rows = async (page: Page): Promise<Row[]> => (await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[];
const legsQuery = (rs: Row[]) => rs.map((r) => `${r.market.id}:${r.side.side_index}`).join(",");
const watchCls = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
const shot = async (page: Page, name: string) => { if (process.env.WT3E_SHOTS) await page.screenshot({ path: path.join(__dirname, "../../../docs/launch/review/wt3e", name) }); };

/** Four legs: one same-event pair (two markets of one event) and two legs from two other events. */
async function fourLegs(page: Page): Promise<Row[]> {
  const all = await rows(page);
  const byEvent = new Map<string, Row[]>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].map((l) => [...new Map(l.map((r) => [r.market.id, r])).values()]).find((l) => l.length >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const two = pair!.slice(0, 2);
  const others = all.filter((r, i) => r.market.event_id !== two[0]!.market.event_id && all.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, 2);
  return [...two, ...others];
}

test("a same-event pair in 4 legs: scoring after a 900 ms answer shifts nothing (CLS < 0.02 at 390), and the note names the weaker bet", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(watchCls);
  await page.route("**/api/check/combo", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); await r.continue(); });
  const legs = await fourLegs(page);
  const worst: number[] = [];
  const texts: string[] = [];
  for (let run = 0; run < 3; run++) {
    await page.goto("/check/combo");
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`/check/combo?legs=${legsQuery(legs)}`);
    await expect(page.getByTestId("combo-leg")).toHaveCount(4, { timeout: 30_000 });
    const note = page.getByTestId("combo-same-event");
    await expect(note).toBeVisible({ timeout: 15_000 });
    await expect(note).toContainText(/Drop one of the two .+ bets\./);
    await expect(note).not.toContainText("weaker one");   // not scored yet: nothing to compare
    await page.waitForTimeout(800);
    if (run === 0) await shot(page, "before-tap-390.png");
    const before = await cls(page);
    await page.getByTestId("combo-check-btn").click();
    await expect(page.getByTestId("combo-chance")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    worst.push((await cls(page)) - before);
    if (run === 0) await shot(page, "after-score-390.png");
    texts.push(await note.innerText());
  }
  console.log(`T-wt3e same-event scoring CLS at 390 (900 ms answer), 3 runs: ${worst.map((v) => v.toFixed(4)).join(", ")}`);
  expect(Math.max(...worst)).toBeLessThan(0.02);
  for (const t of texts) expect(t).toMatch(/Drop one of the two .+ bets\. ".+" \(.+\) is the weaker one\./);
});

test("reloading a scored combo link while scrolled down shifts < 0.02 at 768 (2 to 4 legs, with and without a same-event pair, scrolled partway and to the bottom)", async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.addInitScript(watchCls);
  const all = await rows(page);
  const distinctLegs = all.filter((r, i) => all.findIndex((x) => x.market.event_id === r.market.event_id) === i);
  const withPair = await fourLegs(page);
  const variants: [string, Row[]][] = [["2 legs", distinctLegs.slice(0, 2)], ["3 legs", distinctLegs.slice(0, 3)], ["4 legs", distinctLegs.slice(0, 4)], ["4 legs with a same-event pair", withPair]];
  const out: string[] = [];
  let worst = 0;
  for (const [label, legs] of variants) {
    for (const where of ["400", "bottom"]) {
      let w = 0;
      for (let run = 0; run < 3; run++) {
        await page.goto(`/check/combo?legs=${legsQuery(legs)}&check=1`);
        await expect(page.getByTestId("combo-chance")).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(600);
        await page.evaluate((y) => window.scrollTo(0, y === "bottom" ? document.documentElement.scrollHeight : 400), where);
        await page.waitForTimeout(300);
        await page.reload();
        await expect(page.getByTestId("combo-chance")).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(1200);
        w = Math.max(w, await cls(page));
        if (run === 0 && label === "4 legs" && where === "bottom") await shot(page, "reload-scored-768.png");
      }
      out.push(`${label}, scrolled ${where}: ${w.toFixed(4)}`);
      worst = Math.max(worst, w);
    }
  }
  console.log(`T-wt3e reload scored link CLS at 768, worst of 3: ${out.join("; ")}`);
  expect(worst).toBeLessThan(0.02);
});
