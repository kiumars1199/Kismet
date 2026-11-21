// docs/18 (Lane C): the long-shot fixture (id 9900010: Yes at 10¢, wins 14%, +4 pts, tier "edge"), the 10x+ chip,
// and building a 2-leg combo from one event (same-event warning).
import { expect, test } from "@playwright/test";

// T-302: Best bets no longer has "Big payouts" / "More bets with an edge" rows or Pays chips (one chip row, docs/OVERHAUL.md
// §B). The long shot is lower confidence and not on Polymarket US, so it shows only with a payout filter (which widens
// to both tiers, tierOf) and international bets included; its record sits inside "Why this bet?".
test("long shot: a 10x+ payout filter with international bets brings it in, with its losing band record", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main [data-tier=edge]").filter({ hasText: "Harbor City" })).toHaveCount(0);
  await page.goto("/?x0=10&us=0");
  const card = page.locator("article[data-tier=edge]").filter({ hasText: "Harbor City" }).first();
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-venue", "intl-only");
  await expect(card.getByTestId("card-chance")).toHaveText("14% chance to win");
  await card.getByText("Why this bet?").click();
  await expect(card.getByText(/^Lower:/)).toBeVisible();
  await expect(card.getByTestId("band-record")).toContainText("(lost money)");
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
    const add = drawer.getByRole("button", { name: "Add to combo" });
    await expect(add.getByTestId("beta-badge")).toHaveCount(0);   // QA-D: Combos is live, no Beta tag
    await add.click();
    await expect(drawer.getByRole("button", { name: "In combo ✓" })).toBeVisible();
  }
  const tray = page.getByTestId("combo-tray");
  await expect(tray).toBeVisible();
  await expect(tray.getByTestId("beta-badge")).toHaveCount(0);
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

// docs/19 P5: the Combos page browses by payout; every card pays at least the chosen floor.
// T-302: the Combos row left Best bets (one list for casual bettors); Combos keeps its own page.
test("combos page: payout tabs, each card pays at least the floor, Build this combo opens the tray", async ({ page }) => {
  await page.goto("/combos");
  await page.evaluate(() => localStorage.removeItem("me-combo-v1"));
  await expect(page.getByRole("heading", { level: 1, name: "Combos" })).toBeVisible();
  // QA-D: Combos and Kalshi are live (not beta): no banner, no Beta tag; the nav link comes from the server (#17/#73)
  await expect(page.getByTestId("beta-banner")).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: /^Combos/ })).toBeVisible();
  await expect(page.locator("header").getByText("Beta")).toHaveCount(0);
  for (const p of [2, 3, 5, 10]) {
    await page.getByRole("button", { name: `Pays ${p}x+` }).click();
    await expect(page).toHaveURL(new RegExp(`pays=${p}$`));
    await expect(page.getByRole("button", { name: `Pays ${p}x+` })).toHaveAttribute("aria-pressed", "true");
    const cards = page.getByTestId("combo-card");
    await expect(cards.first().or(page.getByTestId("combos-empty"))).toBeVisible();
    for (const v of await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-pays"))))) expect(v).toBeGreaterThanOrEqual(p);
  }
  await page.getByRole("button", { name: "Pays 2x+" }).click();
  await page.getByTestId("combo-card").first().getByRole("button", { name: /Build this combo/ }).click();
  await expect(page.getByTestId("combo-tray")).toBeVisible();
});
