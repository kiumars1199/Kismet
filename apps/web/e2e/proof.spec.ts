// T-290: wherever the walk-forward test's return appears, the live record is printed beside it, with the basis on hover.
import { expect, test } from "@playwright/test";
import fixture from "../test/fixtures/backtest.json";
import { ret } from "../lib/format";

const r = fixture.results[String(fixture.chosen_half_life_days ?? "None") as keyof typeof fixture.results].taker;

for (const path of ["/track-record", "/about", "/pricing"]) {
  test(`${path}: the test return sits beside the live record`, async ({ page }) => {
    await page.goto(path);
    const line = page.getByTestId("proof-line");
    await expect(line.getByTestId("proof-test")).toContainText(`${ret(r.roi_pct)} per bet`);
    await expect(line.getByTestId("proof-live")).toContainText(/^Live/);
    await expect(line).toHaveAttribute("title", /^Testing: .*Live: every best bet is logged/);
  });
}

// T-302: Best bets has no stat tiles now (plain page, docs/OVERHAUL.md §B); the test return never shows there without
// the live record, and the page links to the full record.
test("Best bets: no test return without its live record; one link to the track record", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("avg return in testing")).toHaveCount(0);
  await page.getByRole("link", { name: "See how we track results" }).click();
  await expect(page).toHaveURL(/\/track-record$/);
});

test("drawer: the category's test record has its live record beside it", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-row] h3 a").first().click();
  const drawer = page.getByRole("dialog", { name: "Market details" });
  await expect(drawer.getByTestId("tested-line")).toBeVisible();
  await expect(drawer.getByTestId("drawer-live")).toContainText(/^Live/);
});

test("group records with no live counterpart say so: lower-confidence band and combos", async ({ page }) => {
  await page.goto("/?x0=10&us=0");
  const card = page.locator("[data-tier=edge]").filter({ hasText: "Harbor City" }).first();
  await card.getByText("Why this bet?").click();
  await expect(card.getByTestId("band-record")).toBeVisible();
  await expect(card.getByTestId("band-live")).toHaveAttribute("title", "No live record for lower-confidence bets yet: the live record tracks single best bets only.");
  await page.goto("/combos");
  await expect(page.getByText("No live record for combos yet: the live record tracks single best bets only.").first()).toBeVisible();
});
