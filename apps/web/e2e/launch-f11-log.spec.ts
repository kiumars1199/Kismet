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
});
