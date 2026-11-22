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
  await expect(guide.locator("[data-testid=howto-steps] li")).toHaveCount(3);
  await expect(guide.getByTestId("howto-link")).toHaveAttribute("href", /^https:\/\/polymarket\.(com|us)\//);
  await expect(guide).toContainText("afford to lose");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await guide.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("howto")).toHaveCount(0);
});
