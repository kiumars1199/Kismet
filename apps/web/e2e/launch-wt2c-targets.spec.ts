// T-wt2c (walk-through 2): tap targets at 390 are at least 44 px (44 wide where short), the top nav is at least 24 px at 1440,
// and the drawer has a single-bet "Check this bet" entry beside "Add to combo checker".
import { expect, test, type Page } from "@playwright/test";

const sizes = (page: Page, sel: string) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent ?? "").trim().slice(0, 30), w: r.width, h: r.height }; }), sel);

test("/markets at 390: the row title links are at least 44 px tall", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/markets");
  const sel = 'main a[href*="m="][href*="side="]:not([data-testid="check-link"])';
  await expect(page.locator(sel).first()).toBeVisible({ timeout: 30_000 });
  const s = await sizes(page, sel);
  expect(s.length).toBeGreaterThan(3);
  for (const x of s) { expect(x.h, `${x.t} height`).toBeGreaterThanOrEqual(44); expect(x.w, `${x.t} width`).toBeGreaterThanOrEqual(44); }
});

test("the drawer at 390: 'Why two numbers?' and 'Settings' are 44 px targets; 'Check this bet' sits beside 'Add to combo checker'", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/markets?m=6674492&side=0");
  const dlg = page.getByRole("dialog", { name: "Market details" });
  await expect(dlg).toBeVisible({ timeout: 30_000 });
  const check = dlg.getByTestId("check-this-bet");
  await expect(check).toHaveText("Check this bet");
  await expect(check).toHaveAttribute("href", "/check?m=6674492&side=0");
  const combo = dlg.getByTestId("add-combo-checker");
  const [a, b] = [(await check.boundingBox())!, (await combo.boundingBox())!];
  expect(Math.abs(a.y - b.y), "same row").toBeLessThan(4);
  expect(a.height).toBeGreaterThanOrEqual(44);
  for (const name of ["Why two numbers?", "Settings"]) {
    const l = dlg.getByRole("link", { name });
    if (!(await l.count())) continue;   // Settings only shows without a bankroll, the other with a category record
    await l.first().scrollIntoViewIfNeeded();
    const r = (await l.first().boundingBox())!;
    expect(r.height, `${name} height`).toBeGreaterThanOrEqual(44);
    expect(r.width, `${name} width`).toBeGreaterThanOrEqual(44);
  }
});

test("the top nav links are at least 24 px tall at 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pricing");
  const s = await page.evaluate(() => [...document.querySelector("header")!.querySelectorAll("a[href]")].filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent ?? "").trim().slice(0, 30), h: r.height }; }));   // the site header, not a page's own <header>
  expect(s.length).toBeGreaterThan(3);
  for (const x of s) expect(x.h, `${x.t} height`).toBeGreaterThanOrEqual(24);
});

// T-wt2g: the search chips, the header clear-search x, the column chooser and its checkbox rows are 44 px targets
// (a checkbox's label row is its hit area), without making rows taller or the page shift.
test("/markets?q=texans at 390: search chips and Clear search are at least 44 px; the header search keeps its width, and its x (44 px) shows once focused", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/markets?q=texans");
  const chip = page.getByRole("button", { name: /^Remove from search:/ }).first();
  await expect(chip).toBeVisible({ timeout: 30_000 });
  if (process.env.WT2G_SHOTS) await page.screenshot({ path: `${process.env.WT2G_SHOTS}/390-markets-q-texans.png` });   // evidence only
  for (const [name, loc] of [["chip", chip], ["Clear search (row)", page.getByRole("button", { name: "Clear search", exact: true })]] as const) {
    const r = (await loc.boundingBox())!;
    expect(r.height, `${name} height`).toBeGreaterThanOrEqual(44);
    expect(r.width, `${name} width`).toBeGreaterThanOrEqual(44);
  }
  // unfocused: the field is not squeezed by the x (it was 49 px wide with the icon crushed to 6 px)
  const input = page.locator("header input[placeholder^='Search']").first();
  expect((await input.boundingBox())!.width, "search input width").toBeGreaterThanOrEqual(49);
  const icon = page.locator("header label:has(input[placeholder^='Search']) svg").first();
  expect((await icon.boundingBox())!.width, "magnifier width").toBeGreaterThanOrEqual(16);
  await input.click();
  const x = page.getByRole("button", { name: "Clear search" }).first();
  await expect(x).toBeVisible();
  const r = (await x.boundingBox())!;
  expect(r.height).toBeGreaterThanOrEqual(44);
  expect(r.width).toBeGreaterThanOrEqual(44);
});

for (const { w, h } of [{ w: 1440, h: 900 }, { w: 390, h: 844 }]) {
  test(`/markets at ${w}x${h}: 'Choose columns' is 44 px, the menu fits the screen and every column checkbox can be clicked`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/markets");
    const choose = page.getByTitle("Choose columns");
    if (w < 768 && !(await choose.isVisible({ timeout: 5_000 }).catch(() => false))) return;   // phones list cards, with no column chooser
    await expect(choose).toBeVisible({ timeout: 30_000 });
    const r = (await choose.boundingBox())!;
    expect(r.height).toBeGreaterThanOrEqual(44);
    expect(r.width).toBeGreaterThanOrEqual(44);
    // wait for the rows: scrolling before they arrive left the page unscrolled (the sticky header never engaged) and the test flaked
    await expect(page.locator("tbody tr[data-row]").first()).toBeVisible({ timeout: 30_000 });
    // 1. opened from the top of the page (the header is not sticky yet): the menu still fits the screen (it ran ~500 px past the bottom)
    await choose.click();
    const top = page.locator("details[open] > div");
    await expect(top).toBeVisible();
    const tb = (await top.boundingBox())!;
    expect(tb.y + tb.height, "menu bottom is inside the screen (opened at the top of the page)").toBeLessThanOrEqual(h);
    await choose.click();   // close it
    await expect(top).toBeHidden();
    // 2. after scrolling: the table header is sticky (64 px under the top bar), where the menu is used from
    await page.evaluate(() => window.scrollBy(0, 800));
    await expect(choose).toBeVisible();
    await choose.click();
    const panel = page.locator("details[open] > div");
    await expect(panel).toBeVisible();
    const pb = (await panel.boundingBox())!;
    expect(pb.y + pb.height, "menu bottom is inside the screen (opened after scrolling)").toBeLessThanOrEqual(h);
    if (process.env.WT2G_SHOTS) await page.screenshot({ path: `${process.env.WT2G_SHOTS}/${w}-markets-columns.png` });   // evidence only
    const rows = panel.locator("label:has(input[type=checkbox])");
    const n = await rows.count();
    expect(n).toBeGreaterThan(8);   // incl. Market type, Retention, Capacity, Price check, Realistic edge
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await row.scrollIntoViewIfNeeded();
      const b = (await row.boundingBox())!;
      expect(b.y >= 0 && b.y + b.height <= h, `row ${i} is inside the screen after scrolling the menu`).toBe(true);
      const box = row.locator("input");
      const before = await box.isChecked();
      await row.click();
      await expect(box).toBeChecked({ checked: !before });
    }
  });
}
