// F11: one tap on a card adds a row to /journal; a settled fixture bet shows P&L, and the splits add up to the total.
import { expect, test } from "@playwright/test";

test("one tap from a Best bets card adds a row to /journal", async ({ page }) => {
  await page.goto("/bets");
  const card = page.getByTestId("bet-card").first();
  await card.waitFor();
  await card.getByTestId("log-bet").click();
  await expect(card.getByTestId("log-bet-done")).toContainText("Logged");

  await card.getByRole("link", { name: "See My bets" }).click();
  await expect(page).toHaveURL(/\/journal/);
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.locator("tbody tr").first()).toContainText("Open");

  await page.reload();   // kept after a reload
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("settled fixture bets: sport and topic totals equal the profit tile", async ({ page }) => {
  const row = (id: string, o: Record<string, unknown>) => ({
    id, market_id: `fx${id}`, side_index: 0, outcome: "Yes", question: `Fixture ${id}?`, category: "sports", niche: "nfl",
    price: 0.6, shares: 10, fee: 0, placed_at: "2026-11-16T03:30:00.000Z", model_win_prob: 0.7, model_edge: 0.1,
    closing_price: 0.65, result: "won", settled_at: "2026-11-17T00:00:00.000Z", pnl_usd: 4, tags: [], note: null, ...o,
  });
  await page.addInitScript((rows) => {
    if (!localStorage.getItem("me:v1:journal")) localStorage.setItem("me:v1:journal", JSON.stringify(rows));
  }, [row("1", {}), row("2", { result: "lost", pnl_usd: -6, niche: "nba", closing_price: 0.55 }), row("3", { category: "politics", niche: null, pnl_usd: 2.5 })]);
  await page.route("**/api/settle", (r) => r.fulfill({ json: {} }));
  await page.goto("/journal");
  await expect(page.getByTestId("pnl-sport-total")).toHaveText("+$0.50");
  await expect(page.getByTestId("pnl-topic-total")).toHaveText("+$0.50");
  await expect(page.getByText("2 of 3 bets")).toBeVisible();   // beat the closing price
  // by sport, not category: NFL and NBA are separate rows, politics keeps its category name; one label source
  const sport = page.getByTestId("pnl-sport");
  await expect(sport.getByRole("cell", { name: "NFL", exact: true })).toBeVisible();
  await expect(sport.getByRole("cell", { name: "NBA", exact: true })).toBeVisible();
  await expect(sport.getByRole("cell", { name: "Sports", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("pnl-topic").getByRole("cell", { name: "NFL", exact: true })).toBeVisible();
});

test("one tap on the /check result logs the bet", async ({ page }) => {
  await page.goto("/bets");
  const id = await page.getByTestId("bet-card").first().getAttribute("data-market-id");
  await page.goto(`/check?m=${id}&side=0`);
  await page.getByTestId("log-bet").click();
  await expect(page.getByTestId("log-bet-done")).toContainText("Logged");
  await page.goto("/journal");
  await expect(page.locator("tbody tr").first()).toContainText("Open");
});

test("bets list at 390: loading the plan moves nothing (CLS under 0.02)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: test.info().project.use.baseURL });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.route("**/api/trade/config", (r) => r.fulfill({ json: { enabled: false, env: null, extensionId: "", riskUrl: "" } }));
  await page.goto("/bets");
  await page.getByTestId("log-bet").first().waitFor();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1_500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  console.log(`CLS /bets at 390 (paid): ${cls.toFixed(4)}`);
  expect(cls).toBeLessThan(0.02);
  await ctx.close();
});
