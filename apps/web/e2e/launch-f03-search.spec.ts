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

// ---- review fixes (F3 round 2)

test("a direct load of /markets?q=<word> carries the Kalshi matches in the server HTML and on screen", async ({ page, request }) => {
  const html = await (await request.get("/markets?q=Jokic")).text();
  expect(html).toContain("Also on Kalshi");   // server-rendered, no client fetch needed
  expect(html).toContain("Nikola Jokic points");
  await page.goto("/markets?q=Jokic");
  await expect(page.getByTestId("kalshi-results")).toContainText("Also on Kalshi");
  await expect(page.getByTestId("kalshi-row").first()).toContainText("Nikola Jokic points");
});

test("a direct load of the Kalshi view ships its rows and chips in the server HTML", async ({ request }) => {
  const html = await (await request.get("/markets?ven=kalshi&t=sports.nfl")).text();
  expect(html).toContain('data-testid="venue-chips"');   // decided on the server: present in the first paint
  expect(html).toContain("4 Kalshi markets match");
  expect(html).not.toContain("0 markets match");
});

for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`Kalshi view at ${name}px: the header counts Kalshi rows and the Polymarket-only controls are gone`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/markets?ven=kalshi&t=sports.nfl");
    await expect(page.getByTestId("kalshi-row")).toHaveCount(4);
    const header = page.getByRole("heading", { name: "All markets" }).locator("xpath=ancestor::header[1]");
    await expect(header).toContainText("4 Kalshi markets match");
    await expect(header).toContainText("open on Kalshi");
    await expect(header).not.toContainText("0 markets match");
    await expect(header).not.toContainText("Export");
    for (const label of ["Pays", "Chance", "Return", "Closes", "Sort", "Filters", "Best bets only", "Hiding long shots"]) {
      await expect(page.getByRole("button", { name: new RegExp(label) })).toHaveCount(0);
    }
    await expect(page.getByRole("group", { name: "Quick filters" }).getByRole("button").first()).toBeVisible();
    // back to All: the Polymarket controls return
    await page.getByTestId("venue-chips").getByRole("button", { name: "All" }).click();
    await expect(page.getByRole("button", { name: /^Pays/ }).first()).toBeVisible();
  });

  test(`the venue chip row never shifts on /markets at ${name}px (it is in the server HTML)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __chips: number };
      w.__cls = 0;
      w.__chips = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node?: Element }[] }[]) {
          if (e.hadRecentInput) continue;
          w.__cls += e.value;
          // a shift whose moved node is the chip row (or inside it): the row mounted late or changed height
          if (e.sources.some((s) => s.node && (s.node as Element).closest?.('[data-testid="venue-chips"]'))) w.__chips += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/markets");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const { cls, chips } = await page.evaluate(() => ({ cls: (window as unknown as { __cls: number }).__cls, chips: (window as unknown as { __chips: number }).__chips }));
    // origin/final measured 0.27 at 390 and 0.23 at 1440 in this harness; the page must now stay under the 0.1 budget
    console.log(`CLS /markets ${name}px: total ${cls.toFixed(4)}, chip row ${chips.toFixed(4)}`);
    expect(chips).toBe(0);
    expect(cls).toBeLessThan(0.1);
  });
}
