// S3 (docs/12): open a flag → drawer shows price check, stake table, curve; custom stake $250 recomputes.
// The live order book (/api/book → Polymarket) is mocked so the run is offline and deterministic.
import { expect, test } from "@playwright/test";

const row = (stake: number) => ({ stake_usd: stake, filled_usd: stake, shares: stake / 0.68, avg_price: 0.68, edge: 0.2, expected_profit_usd: stake * 0.3, roi_pct: 30 });
const book = (stake?: number) => ({
  book_ok: true, best_bid: 0.67, best_ask: 0.68, book_mid: 0.675, spread: 0.01, spread_cost: 0.005, fee_at_ask: 0.01,
  gross_edge: 0.22, net_edge: 0.2, retention: 0.9, capacity_usd: 5000, limit_price: 0.67, limit_edge: 0.21, verdict: "worth it",
  stakes: [25, 100, 500, 1000, ...(stake ? [stake] : [])].sort((a, b) => a - b).map(row),
  fetched_at: Date.now(),
});

test("S3 drawer: price check, stake table, curve, custom stake", async ({ page }) => {
  await page.route("**/api/book*", (r) => {
    const stake = Number(new URL(r.request().url()).searchParams.get("stake")) || undefined;
    return r.fulfill({ json: book(stake) });
  });
  await page.goto("/");
  await page.locator("[data-row] h3 a").first().click();

  const drawer = page.getByRole("dialog", { name: "Market details" });
  await expect(page).toHaveURL(/[?&]m=/);
  await expect(drawer.getByText("Price check ✓ fair fill")).toBeVisible();
  const stakes = drawer.getByRole("table");
  await expect(stakes.getByRole("columnheader", { name: "You bet" })).toBeVisible();
  await expect(stakes.locator("tbody tr")).toHaveCount(4);
  await expect(drawer.getByRole("img", { name: /^Chart:/ })).toBeVisible();

  await drawer.getByLabel("Your own stake").fill("250");
  await drawer.getByRole("button", { name: "Check", exact: true }).click();
  await expect(stakes.locator("tbody tr")).toHaveCount(5);
  await expect(stakes.locator("tbody tr", { hasText: "$250" })).toContainText("+$75");
});

// T-289: one return figure per bet, and the same fee-inclusive payout, on the card and in the drawer headline.
test("card and drawer show the same return, points, wins-about and payout", async ({ page }) => {
  await page.route("**/api/book*", (r) => r.fulfill({ json: book() }));
  await page.goto("/");
  const card = page.locator("article[data-row]").first();
  const ret = (await card.getByTestId("bet-return").innerText()).trim();
  const payout = (await card.getByTestId("payout").innerText()).replace(/\s+/g, " ").trim();
  const oneBet = (await card.getByTestId("one-bet").innerText()).replace(/\s+/g, " ");
  const pts = (await card.getByTestId("verdict").innerText()).match(/\(([^)]+)\)/)![1];
  expect(payout).toMatch(/^Bet \$[\d,.]+ → get \$[\d,.]+ after fees if it wins$/);
  expect(oneBet).toMatch(/before fees/);
  await card.locator("h3 a").click();
  const drawer = page.getByRole("dialog", { name: "Market details" });
  await expect(drawer.getByTestId("bet-return")).toHaveText(ret);
  await expect(drawer.getByTestId("payout")).toHaveText(payout);
  await expect(drawer.getByTestId("verdict")).toContainText(`(${pts})`);
  await expect(drawer.getByTestId("one-bet")).toContainText(oneBet.match(/wins about .+$/)![0].trim());
});
