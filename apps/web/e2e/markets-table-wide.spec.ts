// /markets table (follow-up to #77): it fits from 1280 px (so its header keeps sticking there), and below that, where it scrolls
// inside its own box, a right-edge fade says more columns are off to the right.
import { expect, test, type Page } from "@playwright/test";

const PRO = ["mid", "spread", "fee", "volume", "volume_24h", "liquidity", "evidence", "level", "type", "retention", "capacity", "verdict", "realistic"];
/** Turn Pro columns on the way the column chooser stores them (localStorage me.columns.v1). */
const withColumns = (page: Page, ids: string[]) => page.addInitScript((c) => { try { localStorage.setItem("me.columns.v1", JSON.stringify(Object.fromEntries(c.map((id) => [id, true])))); } catch {} }, ids);
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

test("/markets at 1280px: default columns, no fade (nothing to scroll)", async ({ page }) => {
  await open(page, 1280);
  await expect(page.getByTestId("table-fade")).toHaveAttribute("data-on", "false");
  await expect(page.getByTestId("table-fade")).toHaveCSS("opacity", "0");
});

// Extra columns make the table wider than the box: the box must then scroll (overflow-x-auto at every width, xl included), the page
// must not, and the fade says there is more to the right at xl too. `data-on` must not flip-flop once the box scrolls.
for (const [label, cols, w] of [["all 21 columns", PRO, 1280], ["all 21 columns", PRO, 1440], ["one extra column (Volume)", ["volume"], 1280]] as const) {
  test(`/markets with ${label} at ${w}px: the page does not scroll sideways, the box does, and the fade is on and stays on`, async ({ page }) => {
    await withColumns(page, [...cols]);
    await open(page, w);
    await expect(page.locator("table thead th", { hasText: (cols as readonly string[]).includes("spread") ? "Realistic edge" : "Volume" }).first()).toBeAttached();   // the saved columns are applied after hydration
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => { const b = document.querySelector("table")!.parentElement!; return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, over: b.scrollWidth - b.clientWidth, ox: getComputedStyle(b).overflowX }; });
    console.log(`/markets ${label} ${w}px: scrollWidth ${m.sw}, innerWidth ${m.iw}, box overflow ${m.over}, overflow-x ${m.ox}`);
    expect(m.sw).toBe(m.iw);
    expect(m.over).toBeGreaterThan(0);
    expect(m.ox).toBe("auto");
    const fade = page.getByTestId("table-fade");
    await expect(fade).toBeVisible();
    for (let i = 0; i < 8; i++) { await expect(fade).toHaveAttribute("data-on", "true"); await page.waitForTimeout(250); }
  });
}

test("/markets default columns at 1280px: data-on stays false (no flip-flop) and the box is overflow-visible", async ({ page }) => {
  await open(page, 1280);
  const fade = page.getByTestId("table-fade");
  for (let i = 0; i < 8; i++) { await expect(fade).toHaveAttribute("data-on", "false"); await page.waitForTimeout(250); }
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("table")!.parentElement!).overflowX)).toBe("visible");
});

test("/markets: an event group row says 'Denmark vs. Norway', not '... - More Markets'", async ({ page }) => {
  await open(page, 1440);
  const group = page.locator("table tbody tr a[href^='/event/']", { hasText: "Denmark vs. Norway" }).first();
  await expect(group).toBeVisible();
  expect(await page.locator("table tbody tr a[href^='/event/']").allInnerTexts()).not.toContainEqual(expect.stringMatching(/more markets/i));
});
