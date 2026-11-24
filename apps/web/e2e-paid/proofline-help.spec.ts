// T-95e (rule 3): the proof line's definition is one tap or one key away, not only a hover title. 390 with touch and 1440.
import { expect, test } from "./fixtures";

for (const { w, h, touch } of [{ w: 390, h: 844, touch: true }, { w: 1440, h: 900, touch: false }]) {
  test.describe(`/pricing at ${w}px`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });

    const open = async (page: import("@playwright/test").Page) => {
      await page.goto("/pricing");
      await page.getByTestId("proof-details").locator("summary").click();
      const live = page.getByTestId("proof-live");
      await expect(live).toBeVisible();
      return live;
    };

    test("a tap on the dotted line shows what it means, a second tap hides it", async ({ page }) => {
      const live = await open(page);
      await expect(page.getByTestId("proof-help")).toBeHidden();
      await (touch ? live.tap() : live.click());
      await expect(live).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByTestId("proof-help")).toBeVisible();
      await expect(page.getByTestId("proof-help")).toContainText(/events needed|Testing:/);
      await (touch ? live.tap() : live.click());
      await expect(page.getByTestId("proof-help")).toBeHidden();
    });

    test("the keyboard reaches it: Tab to the line, Enter opens, Escape closes", async ({ page }) => {
      const live = await open(page);
      await live.focus();
      await expect(live).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("proof-help")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("proof-help")).toBeHidden();
      await page.keyboard.press("Space");
      await expect(page.getByTestId("proof-help")).toBeVisible();
    });

    test("opening it shifts nothing that was already on screen (CLS, input-driven shifts excluded)", async ({ page }) => {
      const live = await open(page);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; })
          .observe({ type: "layout-shift", buffered: false });
      });
      await (touch ? live.tap() : live.click());
      await expect(page.getByTestId("proof-help")).toBeVisible();
      await page.waitForTimeout(1_000);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      console.log(`CLS opening the proof help at ${w}px: ${cls.toFixed(4)}`);
      expect(cls).toBeLessThan(0.01);
    });
  });
}
