// T-wt3b (walk-through 3): the combo checker keeps its legs in the URL (reload and share), restores without a shift, scores without a
// shift, and tells you what to do about same-event legs. Fixture data, demo server.
import { expect, test, type Page } from "@playwright/test";

type Row = { market: { id: string; event_id: string }; side: { side_index: number } };
const rows = async (page: Page): Promise<Row[]> => (await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[];
const distinct = (all: Row[], n: number) => all.filter((r, i) => all.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, n);
const legsQuery = (rs: Row[]) => rs.map((r) => `${r.market.id}:${r.side.side_index}`).join(",");
const SIZES = [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const;
const watchCls = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

// 1. Legs kept in this tab come back on a fresh mount without moving the page: 2, 3 and 4 legs, five runs each, < 0.02.
for (const [name, size] of SIZES) {
  test(`restoring 2, 3 and 4 legs on a fresh load shifts nothing: CLS < 0.02 at ${name}px (5 runs each)`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize(size);
    await page.addInitScript(watchCls);
    const all = distinct(await rows(page), 4);
    const worst: Record<string, number> = {};
    for (const n of [2, 3, 4]) {
      for (let run = 0; run < 5; run++) {
        await page.goto("/check/combo");
        await page.evaluate(() => sessionStorage.clear());
        await page.goto(`/check/combo?legs=${legsQuery(all.slice(0, n))}`);   // loads the legs; they are kept in this tab
        await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
        await page.goto("/check/combo");   // no legs in the URL: restored from this tab
        await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
        await page.waitForTimeout(700);
        worst[`${n}-stored`] = Math.max(worst[`${n}-stored`] ?? 0, await cls(page));
        await page.goto(`/check/combo?legs=${legsQuery(all.slice(0, n))}`);   // a reload / shared link
        await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
        await page.waitForTimeout(700);
        worst[`${n}-url`] = Math.max(worst[`${n}-url`] ?? 0, await cls(page));
      }
    }
    console.log(`T-wt3b restore CLS at ${name}px, worst of 5: ${Object.entries(worst).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(", ")}`);
    for (const [k, v] of Object.entries(worst)) expect(v, k).toBeLessThan(0.02);
  });

  // 2. Tapping "Check this combo" when the answer takes 900 ms: nothing moves (3 and 4 legs).
  test(`scoring 3 and 4 legs after a 900 ms answer shifts nothing: CLS < 0.02 at ${name}px`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(size);
    await page.addInitScript(watchCls);
    await page.route("**/api/check/combo", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); await r.continue(); });
    const all = distinct(await rows(page), 4);
    const out: string[] = [];
    for (const n of [3, 4]) {
      await page.goto("/check/combo");
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(`/check/combo?legs=${legsQuery(all.slice(0, n))}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
      await page.waitForTimeout(700);
      const before = await cls(page);
      await page.getByTestId("combo-check-btn").click();
      await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      const delta = (await cls(page)) - before;
      out.push(`${n} legs ${delta.toFixed(4)}`);
      expect(delta, `${n} legs`).toBeLessThan(0.02);
    }
    console.log(`T-wt3b scoring CLS (900 ms answer) at ${name}px: ${out.join(", ")}`);
  });
}

// 3. Share: "Copy link" encodes every leg; opening it loads and scores them.
test("Copy link puts every leg in the URL; opening it loads the legs and scores them", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const ctx = page.context();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const all = distinct(await rows(page), 3);
  await page.goto(`/check/combo?legs=${legsQuery(all)}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(3, { timeout: 30_000 });
  const copy = page.getByRole("button", { name: "Copy link" });
  await expect(copy).toBeVisible();
  expect((await copy.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await copy.click();
  await expect(page.getByTestId("combo-copied")).toHaveText("Link copied");
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(url).pathname).toBe("/check/combo");
  expect(new URL(url).searchParams.get("legs")).toBe(legsQuery(all));
  expect(new URL(url).searchParams.get("check")).toBe("1");
  const other = await (await browser.newContext()).newPage();   // a different tab with nothing stored
  await other.goto(url);
  await expect(other.getByTestId("combo-leg")).toHaveCount(3, { timeout: 30_000 });
  await expect(other.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
  await other.context().close();
});

test("a link with bad or too many legs is cleaned: bad ids and sides dropped, at most 10", async ({ page }) => {
  const all = distinct(await rows(page), 2);
  await page.goto(`/check/combo?legs=${legsQuery(all)},nope!:1,${all[0]!.market.id}:7,%3Cb%3E:0`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.goto(`/check/combo?legs=${Array.from({ length: 14 }, (_, i) => `x${i}:0`).join(",")}`);
  await expect(page.getByTestId("combo-note")).toBeVisible();
  expect(await page.getByTestId("combo-leg").count()).toBeLessThanOrEqual(10);
});

// 4. ?m= is consumed: the URL becomes the legs, a reload keeps them, and a removed leg stays removed.
test("?m= is dropped from the URL after the add; reload keeps the legs; a removed leg stays removed", async ({ page }) => {
  test.setTimeout(120_000);
  const [a, b] = distinct(await rows(page), 2);
  await page.goto(`/check/combo?m=${a!.market.id}&side=${a!.side.side_index}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get("m")).toBeNull();
  expect(new URL(page.url()).searchParams.get("legs")).toBe(`${a!.market.id}:${a!.side.side_index}`);
  await page.reload();
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId("combo-note")).not.toContainText("already in your combo");
  await page.goto(`/check/combo?m=${b!.market.id}&side=${b!.side.side_index}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await expect(page.getByTestId("combo-leg")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });   // the removed leg does not come back
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await page.reload();
  await expect(page.getByTestId("combo-msg")).toContainText("Add at least two");
  expect(new URL(page.url()).search).toBe("");
});

test("a scored combo is scored again after a reload (the URL keeps check=1)", async ({ page }) => {
  const all = distinct(await rows(page), 2);
  await page.goto(`/check/combo?legs=${legsQuery(all)}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get("check")).toBe("1");
  await page.reload();
  await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
});

// 5. Same-event legs: no score, so the page says which leg to drop.
test("same-event legs: the warning says 'Drop one of the two <event> bets.' with a clean event name", async ({ page }) => {
  const all = await rows(page);
  const byEvent = new Map<string, Row[]>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].find((l) => new Set(l.map((r) => r.market.id)).size >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const two = [...new Map(pair!.map((r) => [r.market.id, r])).values()].slice(0, 2);
  await page.goto(`/check/combo?legs=${legsQuery(two)}&check=1`);
  const box = page.getByTestId("combo-same-event");
  await expect(box).toBeVisible({ timeout: 30_000 });
  await expect(box).toContainText(/Drop one of the two .+ bets\./);
  expect(await box.innerText()).not.toMatch(/more markets/i);
});
