// The first-run tour and the bet drawer are both modal. With the tour flag set and a drawer open (/bets?m=<id>), exactly
// one is on top and dismissable: the tour waits while the drawer is open and picks up after it closes. At 390 and 1440.
import { expect, test } from "@playwright/test";

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`the tour waits behind an open drawer and resumes once it closes (${w}px)`, async ({ page }) => {
    test.setTimeout(120_000);   // the dev server compiles a route on its first hit
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => { try { localStorage.setItem("me:v1:tour", "1"); } catch { /* storage off */ } });
    await page.goto("/bets");
    const id = await page.locator("[data-row]").first().getAttribute("data-market-id");
    await page.goto(`/bets?m=${id}&side=0`);
    const drawer = page.getByRole("dialog", { name: "Market details" });
    const tour = page.getByTestId("tour");
    await expect(drawer).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);   // the tour starts on mount: give it the chance to (wrongly) appear
    await expect(tour).toHaveCount(0);   // exactly one modal: the drawer
    // the drawer works: it holds focus and Escape closes it
    await expect(drawer).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    // now the tour is on top and dismissable
    await expect(tour).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("dialog", { name: "A best bet" })).toBeVisible();
    await page.getByRole("button", { name: "Skip tour" }).click();
    await expect(tour).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("me:v1:tour"))).toBeNull();
  });
}
