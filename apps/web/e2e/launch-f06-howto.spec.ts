// F6 (SPEC): the "How to bet this" guide: 3 steps and a link that opens the market on the venue; opens and closes at 390 px.
// Opened here from /check (the card button comes with the BetCard task).
import { expect, test } from "@playwright/test";

test("how to bet this at 390px: 3 steps, the venue link, close", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const id = await page.locator("[data-row] h3 a").first().getAttribute("href").then((x) => new URL(x!, "http://x").searchParams.get("m")!);
  await page.goto(`/check?m=${id}&side=0`);
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("howto")).toHaveCount(0);
  await page.getByRole("button", { name: "How to bet this" }).click();
  const guide = page.getByTestId("howto");
  // nothing is known available (F9 not merged / no state): no venue preselected, each venue says to check
  await expect(guide.getByTestId("howto-steps")).toHaveCount(0);
  await expect(guide.getByTestId("howto-link")).toHaveCount(0);
  await expect(guide.getByTestId("howto-avail").first()).toContainText(/^Check .+ for /);
  await guide.locator("[data-testid^=howto-venue-]").first().click();
  await expect(guide.locator("[data-testid=howto-steps] li")).toHaveCount(3);
  await expect(guide.getByTestId("howto-avail-line")).toContainText("Check ");
  await expect(guide.getByTestId("howto-link")).toHaveAttribute("href", /^https:\/\/polymarket\.(com|us)\//);
  // sources one tap away
  await guide.getByTestId("howto-sources").locator("summary").click();
  await expect(guide.getByTestId("howto-sources").locator("a")).toHaveCount(3);
  await expect(guide.getByTestId("howto-sources")).toContainText(/Read 20\d\d-\d\d-\d\d/);
  // exactly one afford note on the page
  await expect(page.getByText("afford to lose")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await guide.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("howto")).toHaveCount(0);
});

test("how to bet this from a card at 390px: pick a venue, 3 steps, sources, link, close", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bets");
  const card = page.locator("[data-testid=bet-card]").first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: "How to bet this" }).click();
  const guide = card.getByTestId("howto");
  await expect(page.locator("[data-testid=drawer], [role=dialog]")).toHaveCount(0);   // the tap did not open the drawer
  await expect(guide.getByTestId("howto-steps")).toHaveCount(0);                       // no venue assumed
  await guide.locator("[data-testid^=howto-venue-]").first().click();
  await expect(guide.locator("[data-testid=howto-steps] li")).toHaveCount(3);
  await guide.getByTestId("howto-sources").locator("summary").click();
  await expect(guide.getByTestId("howto-sources").locator("a")).toHaveCount(3);
  await expect(guide.getByTestId("howto-link")).toHaveAttribute("href", /^https:\/\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await guide.getByRole("button", { name: "Close" }).click();
  await expect(card.getByTestId("howto")).toHaveCount(0);
});
