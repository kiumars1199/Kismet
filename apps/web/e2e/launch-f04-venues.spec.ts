// F4: the same outcome on every venue (fixture test/fixtures/venues.json: 6674492 and 7077573 on 3 venues, 7078474 on 2).
import { expect, test } from "@playwright/test";

for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`/m/<id> with 3 venues shows 3 rows and exactly one "Pays most here" at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/m/6674492");
    const block = page.getByTestId("venues-block");
    await expect(block).toBeVisible();
    await expect(block.locator("li[data-venue]")).toHaveCount(3);
    await expect(block.getByTestId("pays-most")).toHaveCount(1);
    await expect(block.locator('li[data-venue="us"]').getByTestId("pays-most")).toBeVisible();   // US has the lower price, the highest payout
    // Kalshi: a % and no payout, and never the marked one
    const kalshi = block.locator('li[data-venue="kalshi"]');
    await expect(kalshi).toContainText("%");
    await expect(kalshi).not.toContainText("x");
    await expect(kalshi.getByTestId("pays-most")).toHaveCount(0);
    expect(await block.innerText()).not.toMatch(/¢/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("a market on 2 venues shows Kalshi as Not listed", async ({ page }) => {
  await page.goto("/m/7078474");
  const block = page.getByTestId("venues-block");
  await expect(block.locator('li[data-venue="kalshi"]')).toContainText("Not listed");
  await expect(block.getByTestId("pays-most")).toHaveCount(1);
});

test("a market on one venue has no block", async ({ page }) => {
  await page.goto("/m/6417673");
  await expect(page.getByTestId("venues-block")).toHaveCount(0);
});
