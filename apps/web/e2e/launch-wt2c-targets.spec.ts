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
