// Nov 22 (handoff 1d): a phone gets the card layout from the first HTML, before React hydrates.
// The app's script bundles are blocked, so the page stays as the server sent it (the inline streaming
// scripts still run, as on a slow phone before the bundles arrive).
import { expect, test, type Page } from "@playwright/test";

const noBundles = (page: Page) => page.route(/\/_next\/static\/chunks\/.*\.js/, (r) => r.abort());

test.use({ viewport: { width: 390, height: 844 } });

for (const url of ["/markets", "/bets"]) test(`before hydration, phone ${url}: cards, no table`, async ({ page }) => {
  await noBundles(page);
  await page.goto(url);
  await expect(page.locator("main [data-market-id]:visible").first()).toBeVisible();
  await expect(page.locator("main table")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("before hydration, desktop /markets shows the table", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await noBundles(page);
  await page.goto("/markets");
  await expect(page.locator("main table")).toBeVisible();
});

test("after hydration, phone /markets keeps one layout only", async ({ page }) => {
  await page.goto("/markets");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main table")).toHaveCount(0);
});
