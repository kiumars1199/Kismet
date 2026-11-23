// /markets table (follow-up to #77): it fits from 1280 px (so its header keeps sticking there), and below that, where it scrolls
// inside its own box, a right-edge fade says more columns are off to the right.
import { expect, test, type Page } from "@playwright/test";

const open = async (page: Page, w: number, h = 900) => {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/markets");
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
};

for (const w of [1280, 1366, 1440]) {
  test(`/markets at ${w}px: the table fits, the page does not scroll sideways`, async ({ page }) => {
    await open(page, w);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, box: document.querySelector("table")!.parentElement!.scrollWidth - document.querySelector("table")!.parentElement!.clientWidth }));
    console.log(`/markets ${w}px: scrollWidth ${m.sw}, innerWidth ${m.iw}, table box overflow ${m.box}`);
    expect(m.sw).toBe(m.iw);
    expect(m.box).toBeLessThanOrEqual(0);   // nothing to scroll inside the box either
  });
}

test("/markets at 1280px: the header still sticks under the top bar (64 px) after the page scrolls", async ({ page }) => {
  await open(page, 1280);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(500);
  const top = await page.locator("table thead").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.round(top)).toBe(64);
});

test("/markets at 768px: a right-edge fade shows before scrolling, is gone at the end, and costs no layout shift", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await open(page, 768);
  const fade = page.getByTestId("table-fade");
  await expect(fade).toHaveAttribute("data-on", "true");
  await expect(fade).toHaveCSS("opacity", "1");
  const box = page.locator("table").locator("xpath=..");
  await box.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect(fade).toHaveAttribute("data-on", "false");
  await expect(fade).toHaveCSS("opacity", "0");
  await box.evaluate((el) => { el.scrollLeft = 0; });
  await expect(fade).toHaveAttribute("data-on", "true");
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
});

test("/markets at 1280px: no fade (nothing to scroll)", async ({ page }) => {
  await open(page, 1280);
  await expect(page.getByTestId("table-fade")).toBeHidden();
});
