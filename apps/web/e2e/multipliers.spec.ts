// docs/18 (Lane C): the long-shot fixture (id 9900010: Yes at 10¢, wins 14%, +4 pts, tier "edge"), the 10x+ chip,
// and building a 2-leg combo from one event (same-event warning).
import { expect, test } from "@playwright/test";

const LONG_SHOT = "Will Harbor City win the 2026 Island Cup?";

test("long shot sits in 'More bets with an edge' with Lower confidence and its losing band record", async ({ page }) => {
  await page.goto("/");
  const section = page.getByTestId("more-edge");
  // P6: the rows below the fold load when scrolled near (no protected fetch on a plain page load)
  await expect(async () => {
    await page.mouse.wheel(0, 1500);
    await expect(section.getByRole("heading", { name: /More bets with an edge/ })).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId("big-payouts")).toBeVisible();
  const card = section.locator("[data-tier=edge]").filter({ hasText: LONG_SHOT });
  await expect(card).toBeVisible();
  await expect(card.getByText("Lower confidence")).toBeVisible();
  await expect(card.getByTestId("one-bet")).toContainText("Pays 10x");
  await expect(card.getByTestId("one-bet")).toContainText("wins about 1 in 7");
  await expect(card.getByText("+4 pts")).toBeVisible();
  await expect(card.getByTestId("band-record")).toContainText("lost money in testing");
  // Also in Big payouts (both tiers, 3x+); nowhere else, so not in the main Best bets list.
  await expect(page.getByTestId("big-payouts").getByText(LONG_SHOT)).toBeVisible();
  await expect(page.locator("[data-tier=edge]").filter({ hasText: LONG_SHOT })).toHaveCount(2);
});

test("10x+ chip brings the long shot into the main list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("group", { name: "Payout" }).getByRole("button", { name: "Pays 10x+" }).click();
  await expect(page).toHaveURL(/[?&]x0=10/);
  await expect(page.getByRole("group", { name: "Payout" }).getByRole("button", { name: "Pays 10x+" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("more-edge")).toHaveCount(0);
  await expect(page.locator("[data-tier=edge]").filter({ hasText: LONG_SHOT }).first()).toBeVisible();
});

test("drawer: long-shot line under 25% chance", async ({ page }) => {
  await page.goto("/?m=9900010");
  const drawer = page.getByRole("dialog", { name: "Market details" });
  await expect(drawer.getByTestId("long-shot-line")).toContainText("Most of the time this loses.");
});

test("combo: two legs from one event show the same-event warning", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("me-combo-v1"));
  for (const id of ["6674492", "6674493"]) {
    await page.goto(`/?m=${id}`);
    const drawer = page.getByRole("dialog", { name: "Market details" });
    await drawer.getByRole("button", { name: "Add to combo" }).click();
    await expect(drawer.getByRole("button", { name: "In combo ✓" })).toBeVisible();
  }
  const tray = page.getByTestId("combo-tray");
  await expect(tray).toBeVisible();
  await expect(tray.getByText("Your combo · 2 legs")).toBeVisible();
  await expect(tray.getByTestId("combo-summary")).toContainText(/Pays \d/);
  await expect(tray.getByTestId("same-event")).toContainText("same event");

  // Persisted locally: survives a reload; Clear empties it.
  await page.goto("/");
  await expect(page.getByTestId("combo-tray")).toBeVisible();
  await page.getByRole("button", { name: "Expand combo" }).click();
  await page.getByRole("button", { name: "Clear combo" }).click();
  await expect(page.getByTestId("combo-tray")).toHaveCount(0);
});
