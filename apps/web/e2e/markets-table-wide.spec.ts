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
for (const [label, cols, w] of [["all 21 columns", PRO, 1280], ["all 21 columns", PRO, 1440], ["six extra columns", ["mid", "spread", "fee", "volume", "volume_24h", "liquidity"], 1280]] as const) {
  test(`/markets with ${label} at ${w}px: the page does not scroll sideways, the box does, and the fade is on and stays on`, async ({ page }) => {
    await withColumns(page, [...cols]);
    await open(page, w);
    await expect(page.locator("table thead th", { hasText: (cols as readonly string[]).includes("realistic") ? "Realistic edge" : "Liquidity" }).first()).toBeAttached();   // the saved columns are applied after hydration
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

test("/markets at 390px: the card list's event group header drops '- More Markets' too", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/markets");
  const heads = page.locator("main li.font-heading");
  await expect(heads.first()).toBeVisible({ timeout: 30_000 });
  const texts = await heads.allInnerTexts();
  console.log(`/markets 390 group headers: ${JSON.stringify(texts)}`);
  expect(texts).toContain("Denmark vs. Norway");
  expect(texts.join("|")).not.toMatch(/more markets/i);
});

test("/check: the event line under a market's title drops '- More Markets'", async ({ page }) => {
  await page.goto("/check?m=6674492&side=0");
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Denmark vs. Norway").first()).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/more markets/i);
});

// CI measured the default columns NOT fitting at 1280 (a different font made the table wider), so the header stopped sticking. The
// table's narrowest width (what it needs when squeezed) must leave real room in the box at 1280, whatever the font: at least 150 px
// (about 15% wider text still fits), and the same at 1366.
for (const w of [1280, 1366]) {
  test(`/markets at ${w}px: the default columns' narrowest width leaves at least 150 px of room in the box`, async ({ page }) => {
    await open(page, w);
    const r = await page.evaluate(() => {
      const t = document.querySelector("table")!;
      const keep = t.style.width; t.style.width = "min-content"; const min = t.getBoundingClientRect().width; t.style.width = keep;
      return { box: t.parentElement!.clientWidth, min };
    });
    console.log(`/markets ${w}px: box ${r.box}, narrowest table ${Math.round(r.min)}, room ${Math.round(r.box - r.min)}`);
    expect(r.box - r.min).toBeGreaterThanOrEqual(150);
  });
}

test("/markets with one extra column (Volume) at 1280px: it fits now (Bet and Topic wrap when squeezed), no scroll, header sticks", async ({ page }) => {
  await withColumns(page, ["volume"]);
  await open(page, 1280);
  await expect(page.locator("table thead th", { hasText: "Volume" }).first()).toBeAttached();
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => { const b = document.querySelector("table")!.parentElement!; return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, over: b.scrollWidth - b.clientWidth }; });
  expect(m.sw).toBe(m.iw);
  expect(m.over).toBeLessThanOrEqual(0);
  await expect(page.getByTestId("table-fade")).toHaveAttribute("data-on", "false");
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(500);
  expect(Math.round(await page.locator("table thead").evaluate((el) => el.getBoundingClientRect().top))).toBe(64);
});
