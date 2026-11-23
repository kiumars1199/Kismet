// F9: /markets has a venue link on every row (icon only). The availability is visible above the list and in each link's label.
import { expect, test } from "@playwright/test";

test("/markets: a visible availability line above the list, and in each icon link's label", async ({ page }) => {
  await page.goto("/settings");
  await page.getByTestId("state-select").selectOption("NV");
  await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "us_state")?.value).toBe("NV");
  for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await page.goto("/markets");
    const bar = page.getByTestId("markets-availability");
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText("Polymarket: not available in Nevada");
    const link = page.locator('a[data-venue="polymarket"]').first();
    await expect(link).toHaveAttribute("aria-label", /not available in Nevada/);
    // poll: the page can still be settling (reserved heights) when the rows first appear
    await expect.poll(async () => {
      const [b, l] = await Promise.all([bar.boundingBox(), link.boundingBox()]);
      return b && l ? l.y + 1 - (b.y + b.height) : -1;
    }, { timeout: 10_000 }).toBeGreaterThanOrEqual(0);
  }
});

test("/markets with no state chosen says 'Check your state'", async ({ page }) => {
  await page.goto("/markets");
  await expect(page.getByTestId("markets-availability")).toHaveText(/Check your state/, { timeout: 30_000 });
});
