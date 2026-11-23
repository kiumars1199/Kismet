// F9 follow-up: a signed-out visitor can pick a state. "Check your state" opens the public /state page (no sign-up
// wall; /settings is account-only), and after picking NV the visitor is back where they were with NV's status.
import { expect, test } from "@playwright/test";

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`signed out at ${size.width}: Check your state → pick NV → the note shows Nevada, no sign-up`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/?us=0&g=0&ps=50");
    await expect(page.getByTestId("bet-card").first()).toBeVisible({ timeout: 30_000 });
    const note = page.locator('[data-testid="venue-availability"]:has(+ [data-testid="venue-button"])').first();
    await expect(note).toHaveText("Check your state");
    await note.getByRole("link").click();
    await expect(page).toHaveURL(/\/state\?next=/);
    await expect(page).not.toHaveURL(/signup|login|settings/);
    await page.getByTestId("state-select").selectOption("NV");
    await expect(page).toHaveURL(/\/\?us=0&g=0&ps=50$/, { timeout: 15_000 });
    await expect(page.getByTestId("bet-card").first()).toBeVisible({ timeout: 30_000 });
    await expect(note).toHaveText("Polymarket US: not available in Nevada");
    await expect(note).toHaveAttribute("data-status", "restricted");
  });
}

test("/state refuses an off-site next and still works on its own", async ({ page }) => {
  await page.goto("/state?next=//evil.example");
  await page.getByTestId("state-select").selectOption("TX");
  await expect(page.getByTestId("state-select")).toHaveValue("TX");
  // the off-site next is ignored: the page stays on /state on this site, and its Back link goes home
  await expect.poll(() => new URL(page.url()).pathname).toBe("/state");
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");
});
