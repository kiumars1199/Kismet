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

// Layout shifts of this page's own content: a shift counts when one of its nodes is still in the page (nodes that were removed
// again, such as a loading placeholder, do not count). The footer swap is gone since onboarding's #62 (skeleton fallback).
const OWN_CLS_INIT = () => {
  const w = window as unknown as { __shifts: { value: number; nodes: Node[] }[] };
  w.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node?: Node }[] }[]) {
      if (!e.hadRecentInput) w.__shifts.push({ value: e.value, nodes: e.sources.flatMap((x) => (x.node ? [x.node] : [])) });
    }
  }).observe({ type: "layout-shift", buffered: true });
};
const OWN_CLS_READ = () => {
  const shifts = (window as unknown as { __shifts: { value: number; nodes: Node[] }[] }).__shifts;
  return shifts.filter((s) => s.nodes.some((n) => n.isConnected)).reduce((a, s) => a + s.value, 0);
};

// Review fixes: the chart card is one height in every state, so nothing below it moves when the history arrives or is empty.
// Measured as the height of whatever occupies the card's slot on every frame from first paint (the lazy-load placeholder,
// the loading skeleton, then the chart or the empty state): it must be 360 px throughout. (A page-wide layout-shift total is
// logged too; the whole-page CLS with paper trading OFF is asserted in the next test.)
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
  expect(b.as_of).toBeGreaterThanOrEqual(b.points.at(-1)!.t);
});

// Review finding: with paper trading off the empty state alone measured 0.20 at 390 and 0.11 at 1440, attributed to history-empty.
// The four state branches now have their own React keys (no reused animated node). The footer swap that inflated this number on a
// first load came from the bare <Suspense> in app/m/[id]/page.tsx (fixed in onboarding's #62), so the whole-page counter below
// counts every shift except those whose only nodes were removed from the page.
// (The paper-Trade and Add-to-combo slots are reserved from the first paint, see the tests below.)
for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  for (const id of ["7078474", "6674492"]) {
    test(`/m/${id} whole-page CLS under 0.1 at ${name}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.addInitScript(OWN_CLS_INIT);
      await page.goto(`/m/${id}`);
      await page.waitForLoadState("networkidle");
      await page.getByTestId(id === "6674492" ? "history-chart" : "history-empty").waitFor();
      await page.waitForTimeout(1200);
      const cls = await page.evaluate(OWN_CLS_READ);
      console.log(`whole-page CLS /m/${id} ${name}px: ${cls.toFixed(4)}`);
      expect(cls).toBeLessThan(0.1);
    });
  }
}

// Review findings (twice): TradeButton and AddToCombo render nothing until /api/trade/config and /api/me answer. When they mount the
// action row wraps (Trade + Add to combo + star + Alert + link = 2 lines at 390 px, the page below jumps 50 px, 0.15 to 0.19). The e2e
// server is a production build (next start) with trading ON and a premium user (combos on). The two answers are held back 700 ms so
// the late items appear AFTER the first paint on every run (on a fast machine they could land before it and hide the shift). Every
// shift on the page whose nodes are still there is counted.
for (const id of ["6674492", "7078474"]) {
  test(`/m/${id} at 390px, trading and combos on: Trade (paper) and Add to combo mount late without moving anything (CLS < 0.1)`, async ({ page }) => {
    const slow = (pattern: string) => page.route(pattern, async (r) => { await new Promise((ok) => setTimeout(ok, 700)); await r.continue(); });
    await slow("**/api/trade/config");
    await slow("**/api/me");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(OWN_CLS_INIT);
    await page.goto(`/m/${id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /^Trade/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to combo/ })).toBeVisible();
    await page.waitForTimeout(1200);
    const cls = await page.evaluate(OWN_CLS_READ);
    console.log(`own CLS /m/${id} 390px, trading + combos on, late answers: ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.1);
  });
}

// A user who is NOT on the trading allow-list gets no empty slot: the server decides the reservation per request (same check as
// /api/trade/config), and the slot goes away whenever the config says enabled:false.
test("trading config says enabled:false: no empty Trade slot is left in the action row", async ({ page }) => {
  await page.route("**/api/trade/config", (r) => r.fulfill({ json: { enabled: false, env: null, extensionId: "", riskUrl: "" } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/m/6674492");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /^Trade/ })).toHaveCount(0);
  await expect(page.getByTestId("trade-slot")).toHaveCount(0);
});
