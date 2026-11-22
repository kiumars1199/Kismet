// F3: every open Kalshi market is searchable and filterable by topic on fixture data (28 Kalshi rows, test/fixtures/kalshi.json).
import { expect, test } from "@playwright/test";

type KalshiBody = { rows: unknown[]; kalshi: { total: number; rows: { title: string; topic: string; venue: string; price_cents: number | null }[] } };

test("GET /api/markets?venue=kalshi&topic=sports.nfl returns Kalshi NFL rows", async ({ request }) => {
  const b = (await (await request.get("/api/markets?venue=kalshi&topic=sports.nfl")).json()) as KalshiBody;
  expect(b.rows).toEqual([]);
  expect(b.kalshi.total).toBe(4);
  expect(b.kalshi.rows.every((r) => r.venue === "kalshi" && r.topic === "sports.nfl")).toBe(true);
});

test("q finds a Kalshi row by a title word", async ({ request }) => {
  const b = (await (await request.get("/api/markets?q=Jokic")).json()) as KalshiBody;
  expect(b.kalshi.rows.map((r) => r.title)).toContain("Nikola Jokic points");
});

test("/api/meta counts by venue", async ({ request }) => {
  const b = (await (await request.get("/api/meta")).json()) as { counts: { polymarket: number; kalshi: number } };
  expect(b.counts.polymarket).toBeGreaterThan(0);
  expect(b.counts.kalshi).toBeGreaterThanOrEqual(20);
});

for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`/markets Kalshi venue: topic filter, rows, "No price yet", no horizontal scroll at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/markets?ven=kalshi&t=sports.nfl");
    await expect(page.getByTestId("kalshi-results")).toBeVisible();
    await expect(page.getByTestId("kalshi-row")).toHaveCount(4);
    await expect(page.getByTestId("venue-chips").getByRole("button", { name: "Kalshi" })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/markets?ven=kalshi&q=unpriced");
    await expect(page.getByTestId("kalshi-no-price")).toHaveText("No price yet");
  });
}

test("the venue chip switches to Kalshi and the URL round-trips", async ({ page }) => {
  await page.goto("/markets");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("venue-chips").getByRole("button", { name: "Kalshi" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("ven")).toBe("kalshi");
  await expect(page.getByTestId("kalshi-results")).toBeVisible();
});
