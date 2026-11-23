// /pricing is plain on a phone (Rule 3): the plans are in the first screen at 390x844, the test-result stats sit in a Details
// expand (still one tap away, with their basis), the Free plan says what "random" means, and the help line's links are tap-sized.
import { expect, test, type Page } from "@playwright/test";

const cls = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
});

test("390x844: the plans start in the first screen; the stats are in a Details expand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");
  const free = page.getByRole("region", { name: "Free" }).or(page.locator('section[aria-labelledby="plan-free"]')).first();
  const box = (await free.boundingBox())!;
  expect(box.y + 160, "the Free plan's name, price and button are above the fold").toBeLessThan(844);
  await expect(page.getByTestId("price-free")).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("heading", { name: "Free", exact: true }).first()).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("link", { name: "See results" })).toBeVisible();
  // the stats are not printed above the plans: they sit in the closed Details
  const details = page.getByTestId("proof-details");
  await expect(details).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("proof-live")).toBeHidden();
  await details.locator("summary").click();
  await expect(page.getByTestId("proof-live")).toBeVisible();
  await expect(page.getByTestId("proof-test")).toBeVisible();
});

test("the Free plan says how the daily bets are picked", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator('section[aria-labelledby="plan-free"]')).toContainText("10 of today's best bets, picked at random each day");
  await expect(page.getByRole("table")).toContainText("10 of today's best bets, picked at random each day");
  await expect(page.locator("main")).not.toContainText("a day, chosen at random");
});

test("help line buttons are at least 44 x 44 px at 390; the comma sits against \"source\"", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");
  const links = page.getByTestId("helpline").first().getByRole("link");
  expect(await links.count()).toBeGreaterThanOrEqual(3);
  for (const l of await links.all()) {
    if (await l.evaluate((el) => el.hasAttribute("data-inline-link"))) continue;   // "source": inline in the sentence (WCAG 2.5.8); hit-tested in e2e-paid/launch-helpline-targets
    const b = (await l.boundingBox())!;
    expect(b.height, `${await l.innerText()} height`).toBeGreaterThanOrEqual(44);
    expect(b.width, `${await l.innerText()} width`).toBeGreaterThanOrEqual(44);
  }
  // the visible gap from the end of "source" to the comma is <= 1 px (it was 2.6 px on final), in every help line on the page
  const gaps = await page.getByTestId("helpline").evaluateAll((ps) => ps.map((p) => {
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const chars: { n: Text; i: number }[] = [];
    for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) for (let i = 0; i < n.length; i++) chars.push({ n, i });
    const text = chars.map((c) => c.n.data[c.i]).join("");
    const k = text.indexOf("source,");
    const rect = (c: { n: Text; i: number }) => { const r = document.createRange(); r.setStart(c.n, c.i); r.setEnd(c.n, c.i + 1); return r.getBoundingClientRect(); };
    return k < 0 ? NaN : rect(chars[k + 6]!).left - rect(chars[k + 5]!).right;
  }));
  console.log("source-to-comma gap px:", gaps.map((g) => g.toFixed(2)).join(", "));
  expect(gaps.length).toBeGreaterThan(0);
  for (const g of gaps) { expect(Number.isNaN(g), "source, found").toBe(false); expect(g).toBeLessThanOrEqual(1); }
});

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`/pricing CLS under 0.1 at ${w}`, async ({ page }) => {
    await cls(page);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
  });
}
