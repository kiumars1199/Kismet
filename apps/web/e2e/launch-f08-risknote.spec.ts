// F8: "Bet only what you can afford to lose." sits next to every bet button on /bets (counts match), at 390 px and
// 1440 px, with no horizontal scroll and CLS < 0.1 on the page's run.
import { expect, test } from "@playwright/test";

for (const [name, size] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`/bets: a risk note next to every bet button at ${name} px, CLS < 0.1`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/bets");
    await expect(page.getByTestId("bet-card").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    const buttons = await page.getByTestId("venue-button").count();
    expect(buttons).toBeGreaterThan(0);
    // each button is followed directly by its note
    const paired = await page.locator('[data-testid="venue-button"] + [data-testid="risk-note"]').count();
    expect(paired).toBe(buttons);
    await expect(page.getByTestId("risk-note").first()).toHaveText("Bet only what you can afford to lose.");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
  });
}
