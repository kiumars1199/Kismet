// F14: the price history chart (fixture test/fixtures/history.json: 6674492 and 7077573 have a series, 7078474 does not).
import { expect, test } from "@playwright/test";

for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`a market with history draws the chart and the basis line at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/m/6674492");
    const chart = page.getByTestId("history-chart");
    await expect(chart).toBeVisible();
    await expect(chart.locator("svg .recharts-line-curve").first()).toBeVisible();
    await expect(page.getByTestId("history-basis")).toContainText("Prices from Polymarket, every 11 hours");
    expect(await page.getByTestId("price-history").innerText()).not.toMatch(/¢/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('a market with no history says "No price history for this market yet" in the same-height box', async ({ page }) => {
  await page.goto("/m/7078474");
  await expect(page.getByTestId("history-empty")).toHaveText("No price history for this market yet");
  await expect(page.getByTestId("history-chart")).toHaveCount(0);
  const box = await page.getByTestId("history-empty").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(190);   // the chart's height: no layout jump between states
});

test("the history API serves the chart's points", async ({ request }) => {
  const b = (await (await request.get("/api/markets/6674492/history")).json()) as { points: unknown[]; venue: string };
  expect(b.venue).toBe("Polymarket");
  expect(b.points.length).toBeGreaterThan(100);
  expect((await request.get("/api/markets/nope/history")).status()).toBe(404);
});

// Review fixes: the chart card is one height in every state, so nothing below it moves when the history arrives or is empty.
// Measured as the height of whatever occupies the card's slot on every frame from first paint (the lazy-load placeholder,
// the loading skeleton, then the chart or the empty state): it must be 360 px throughout. (A page-wide layout-shift total is
// logged too, but not asserted: at 390 px the paper-Trade button that mounts after /api/trade/config in this e2e env adds a
// button row above the card, 0.17 CLS that is not the chart's; the same page with no paper trading measured 0.003.)
for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  for (const id of ["6674492", "7078474"]) {
    test(`/m/${id} (${id === "6674492" ? "chart" : "empty state"}): the card's slot is 360px in every frame at ${name}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.addInitScript(() => {
        const w = window as unknown as { __h: number[]; __cls: number };
        w.__h = [];
        w.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        const tick = () => {
          const el = document.querySelector('[data-testid="price-history"]') ?? document.querySelector(".h-\\[360px\\]");
          if (el) w.__h.push(Math.round(el.getBoundingClientRect().height));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.goto(`/m/${id}`);
      await page.waitForLoadState("networkidle");
      await page.getByTestId(id === "6674492" ? "history-chart" : "history-empty").waitFor();
      await page.waitForTimeout(1200);
      const { h, cls } = await page.evaluate(() => ({ h: (window as unknown as { __h: number[] }).__h, cls: (window as unknown as { __cls: number }).__cls }));
      console.log(`CLS /m/${id} ${name}px: whole page ${cls.toFixed(4)}; slot heights seen ${JSON.stringify([...new Set(h)])}`);
      expect(h.length).toBeGreaterThan(5);
      expect([...new Set(h.filter((x) => x > 0))]).toEqual([360]);   // 0 = the slot element not laid out yet
    });
  }
}

test("the empty state says it plainly, and the details name the source", async ({ page }) => {
  await page.goto("/m/7078474");
  await expect(page.getByTestId("history-empty")).toHaveText("No price history for this market yet");
  await page.getByTestId("history-details").locator("summary").click();
  await expect(page.getByTestId("history-source")).toContainText("Polymarket's own price history");
});

test("with a chart, the details say where it is from and when the latest point is, and no point is newer than the scan", async ({ page, request }) => {
  await page.goto("/m/6674492");
  await page.getByTestId("history-details").locator("summary").click();
  await expect(page.getByTestId("history-source")).toContainText("saved with the latest scan");
  await expect(page.getByTestId("history-source").locator("[data-ago]")).toBeVisible();
  const b = (await (await request.get("/api/markets/6674492/history")).json()) as { points: { t: number }[]; as_of: number; source: string };
  expect(b.source).toBe("file");
  expect(b.points.at(-1)!.t).toBe(b.as_of);
});
