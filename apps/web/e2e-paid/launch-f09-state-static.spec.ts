// F9 (#63 review): signed out, not demo (paid env), "/" is force-static so the layout can't read the state cookie. The note
// must still show the picked state after Check your state → /state → pick NV → back on "/", with no layout shift.
import { expect, test } from "./fixtures";

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`signed out at ${size.width}: / → Check your state → NV → / says not available in Nevada, CLS < 0.1`, async ({ page }) => {
    test.setTimeout(240_000);   // cold next dev compiles
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; })
        .observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    const note = page.getByTestId("venue-availability").first();
    await expect(note).toHaveText("Check your state", { timeout: 60_000 });
    await note.getByRole("link").click();
    await expect(page).toHaveURL(/\/state\?next=%2F$/, { timeout: 60_000 });
    await page.getByTestId("state-select").selectOption("NV");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe("/");
    await expect(page).not.toHaveURL(/signup|login/);
    await expect(page.getByTestId("venue-availability").filter({ hasText: "Nevada" }).first()).toContainText("not available in Nevada", { timeout: 30_000 });
    await page.waitForTimeout(1_000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
  });
}
