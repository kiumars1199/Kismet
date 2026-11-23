// F4: the same outcome on every venue (fixture test/fixtures/venues.json: 7077573 on 3 venues, 6674492 Polymarket + Kalshi, 7078474 Polymarket + US).
import { expect, test } from "@playwright/test";

for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`/m/<id> with 3 venues shows 3 rows and exactly one "Pays most here" at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/m/7077573");
    const block = page.getByTestId("venues-block");
    await expect(block).toBeVisible();
    await expect(block.locator("li[data-venue]")).toHaveCount(3);
    await expect(block.getByTestId("pays-most")).toHaveCount(1);
    await expect(block.getByTestId("pays-most")).toHaveText("Pays most here");
    await expect(block.locator('li[data-venue="polymarket"]').getByTestId("pays-most")).toBeVisible();   // 1.32x vs US 1.29x after each fee
    // Kalshi: a multiplier and a % side by side (its standard fee is counted: 76% + 2 c fee = 1.28x), not the highest here
    const kalshi = block.locator('li[data-venue="kalshi"]');
    await expect(kalshi).toContainText("1.28x");
    await expect(kalshi).toContainText("76%");
    await expect(kalshi.getByTestId("pays-most")).toHaveCount(0);
    await expect(block).not.toContainText("fee not counted");
    await expect(block).not.toContainText("shows its price only");
    expect(await block.innerText()).not.toMatch(/¢/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("a market on 2 venues shows Kalshi as Not listed", async ({ page }) => {
  await page.goto("/m/7078474");
  const block = page.getByTestId("venues-block");
  await expect(block.locator('li[data-venue="kalshi"]')).toContainText("Not listed");
  await expect(block.getByTestId("pays-most")).toHaveText("Pays most here");   // every listed venue has a multiplier: unqualified
});

test("a market on one venue has no block", async ({ page }) => {
  await page.goto("/m/6635049");
  await expect(page.getByTestId("venues-block")).toHaveCount(0);
});

// Review fixes: the block never disagrees with the card (same numbers), and its basis is one tap away.
test("6674492: the card says international only, so the block lists Polymarket US as Not listed", async ({ page }) => {
  await page.goto("/m/6674492");
  await expect(page.getByText("International only, not on Polymarket US").first()).toBeVisible();
  const block = page.getByTestId("venues-block");
  await expect(block.locator('li[data-venue="us"]')).toContainText("Not listed");
  await expect(block.locator('li[data-venue="polymarket"]')).toContainText("1.45x");
});

test("7078474: the block's Polymarket US payout is the card's (1.34x)", async ({ page }) => {
  await page.goto("/m/7078474");
  await expect(page.getByText("Pays 1.34x on Polymarket US").first()).toBeVisible();
  await expect(page.getByTestId("venues-block").locator('li[data-venue="us"]')).toContainText("1.34x");
});

test("basis: source, time and Kalshi match confidence are one tap away", async ({ page }) => {
  await page.goto("/m/7077573");
  const basis = page.getByTestId("venues-basis");
  await expect(basis.locator("li").first()).toBeHidden();   // closed: not in the default view
  await basis.locator("summary").click();
  await expect(basis.locator('li[data-basis="polymarket"]')).toContainText("best ask");
  await expect(basis.locator('li[data-basis="polymarket"] [data-ago]')).toBeVisible();
  await expect(basis.locator('li[data-basis="kalshi"]')).toContainText("97% sure");
  await expect(basis.locator('li[data-basis="kalshi"]')).toContainText("Kalshi's fee is counted");
  await expect(basis.locator('li[data-basis="kalshi"]')).toContainText("standard Kalshi fee");
  await expect(basis.locator('li[data-basis="kalshi"] [data-ago]')).toBeVisible();
});

// A pasted Kalshi link resolves to the matched market once the store keeps the matcher's ticker (kalshi_matched_ticker, set from
// venues.json; kalshi_ticker stays unset so the bet venue does not flip). Fixture: 6674492 <-> KXFIXTURE-6674492 (venues.json + kalshi.json).
const KALSHI_LINK = "https://kalshi.com/markets/kxfixture/denmark-norway-both-teams-to-score/kxfixture-6674492";
test("/check: a pasted Kalshi link resolves to its market (not 'missing') and shows Kalshi's own price", async ({ page }) => {
  await page.goto("/check");
  await page.getByLabel("Market link or words").fill(KALSHI_LINK);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("check-missing")).toHaveCount(0);
  await expect(page.getByText("Denmark vs. Norway").first()).toBeVisible();
  await expect(page.getByTestId("check-kalshi")).toContainText(/Kalshi's own price for Yes is \d+%/);
});
