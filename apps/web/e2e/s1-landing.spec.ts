// S1 (docs/12): land on / → "Open screener" → /markets shows rows and a freshness pill.
import { expect, test } from "@playwright/test";

test("S1 landing → screener rows + freshness pill", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open screener" }).first().click();
  await expect(page).toHaveURL(/\/markets$/);
  await expect(page.locator("[data-row]").first()).toBeVisible();
  await expect(page.getByTestId("freshness")).toBeVisible();
  await expect(page.getByText(/markets? match/)).toBeVisible();
});
