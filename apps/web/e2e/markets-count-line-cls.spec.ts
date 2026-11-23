// /markets at 390: the count line ("N markets match") wrapped from 1 to 2 lines when /api/meta landed and appended
// "· N open (M priced) · scanned …" (CLS 0.068). Its box must be the same height before and after, and the page CLS stay under 0.1.
import { expect, test } from "@playwright/test";

// The Kalshi view's line ("N Kalshi markets match · N open on Kalshi") is one line at 390: no blank 20 px under it.
test("/markets?ven=kalshi count line is one line (20 px) before and after /api/meta at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/meta", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); await r.continue(); });
  await page.goto("/markets?ven=kalshi&t=sports.nfl");
  const line = page.getByTestId("markets-count-line");
  await expect(line).toBeVisible({ timeout: 20_000 });
  await expect(line).toContainText(/Kalshi markets? match/);
  const before = (await line.boundingBox())!.height;
  await expect(line).toContainText("open on Kalshi", { timeout: 10_000 });
  const after = (await line.boundingBox())!.height;
  expect([before, after]).toEqual([20, 20]);
});

for (const [name, size] of [["390", { width: 390, height: 844 }], ["768", { width: 768, height: 1024 }], ["1440", { width: 1440, height: 900 }]] as const) {
  test(`/markets count line keeps its height when /api/meta lands (${name}px)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.route("**/api/meta", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); await r.continue(); });   // meta always lands late
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/markets");
    const line = page.getByTestId("markets-count-line");
    await expect(line).toBeVisible({ timeout: 20_000 });
    await expect(line).toContainText(/markets? match/);
    const before = (await line.boundingBox())!.height;
    await expect(line).toContainText("scanned", { timeout: 10_000 });
    const after = (await line.boundingBox())!.height;
    expect(after, `count line height before ${before} after ${after}`).toBe(before);
    await page.waitForTimeout(800);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`/markets CLS at ${name}px: ${cls.toFixed(4)}; count line ${before}px -> ${after}px`);
    expect(cls).toBeLessThan(0.1);
  });
}
