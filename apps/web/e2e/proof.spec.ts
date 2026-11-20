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

test("Best bets: the 'avg return in testing' tile has the live record beside it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("avg return in testing")).toBeVisible();
  await expect(page.getByTestId("tiles-live")).toContainText(/^Live/);
});

test("drawer: the category's test record has its live record beside it", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-row] h3 a").first().click();
  const drawer = page.getByRole("dialog", { name: "Market details" });
  await expect(drawer.getByTestId("tested-line")).toBeVisible();
  await expect(drawer.getByTestId("drawer-live")).toContainText(/^Live/);
});
