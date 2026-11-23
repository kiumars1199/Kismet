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
// CLS here counts the shifts of the card and of everything after it in the page (the shift the review measured was the empty
// state's shorter box pulling the content below up). The site footer (sometimes re-laid-out on its own under load) is left out. A shift ABOVE the card (the paper-Trade button mounting after
// /api/trade/config in this e2e env, which adds a button row at 390 px) is not the chart's and is left out.
for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  for (const id of ["6674492", "7078474"]) {
    test(`/m/${id} (${id === "6674492" ? "chart" : "empty state"}): no shift from the card or below, and the card is 340px at ${name}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.addInitScript(() => {
        const w = window as unknown as { __shifts: { value: number; nodes: Node[] }[] };
        w.__shifts = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node?: Node }[] }[]) {
            if (!e.hadRecentInput) w.__shifts.push({ value: e.value, nodes: e.sources.flatMap((x) => (x.node ? [x.node] : [])) });
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(`/m/${id}`);
      await page.waitForLoadState("networkidle");
      await page.getByTestId(id === "6674492" ? "history-chart" : "history-empty").waitFor();
      await page.waitForTimeout(1200);
      // classified at the end, once the card is in the page: a shift counts when one of its nodes is the card, inside it, or after it
      const { cls, all } = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="price-history"]')!;
        const shifts = (window as unknown as { __shifts: { value: number; nodes: Node[] }[] }).__shifts;
        const mine = shifts.filter((s) => s.nodes.some((n) => n.isConnected && !(n as Element).closest?.("footer") && (card.contains(n) || !!(card.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING))));
        return { cls: mine.reduce((a, s) => a + s.value, 0), all: shifts.reduce((a, s) => a + s.value, 0) };
      });
      console.log(`CLS /m/${id} ${name}px: card and below ${cls.toFixed(4)}, whole page ${all.toFixed(4)}`);
      expect(cls).toBeLessThan(0.02);
      const box = await page.getByTestId("price-history").boundingBox();
      expect(Math.round(box!.height)).toBe(340);
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
