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

test('a market with no history says "No price history yet" in the same-height box', async ({ page }) => {
  await page.goto("/m/7078474");
  await expect(page.getByTestId("history-empty")).toHaveText("No price history yet");
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
