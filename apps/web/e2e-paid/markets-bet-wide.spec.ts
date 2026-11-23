// /markets Bet cell at 1440 and 1920 for a Free and a Pro account (default columns): Bet never wraps, rows stay one line, the header
// sticks at 64 px, the page does not scroll sideways, CLS < 0.05, and no line starts with a "·".
import { expect, test, type Page } from "./fixtures";
import { expectPlanActive } from "./checkout";

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/account");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}



async function measure(page: Page, who: string, w: number) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto("/account");   // a fresh document: the observer below starts with it
  await page.goto("/markets");
  await expect(page.locator("[data-testid=bet-cell]").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1_500);
  const m = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-testid="bet-cell"]')].map((c) => {
      const s = c.querySelector('[data-testid="bet-side"]')!.getBoundingClientRect();
      const y = c.querySelector('[data-testid="bet-pays"]')!.getBoundingClientRect();
      const dot = c.querySelector('[data-testid="bet-dot"]') as HTMLElement | null;
      return { text: (c as HTMLElement).innerText, side: Math.round(s.width), wrapped: y.top >= s.bottom - 1, leadingDot: !!dot && getComputedStyle(dot).display !== "none" && dot.getBoundingClientRect().top >= y.top - 1 && y.top >= s.bottom - 1, row: (c.closest("tr") as HTMLElement).getBoundingClientRect().height };
    });
    return { cells, over: document.documentElement.scrollWidth - window.innerWidth, cls: (window as unknown as { __cls: number }).__cls };
  });
  console.log(`${who} ${w}: ${m.cells.length} bet cells, wrapped ${m.cells.filter((c) => c.wrapped).length}, tallest row ${Math.max(...m.cells.map((c) => c.row))}, CLS ${m.cls.toFixed(4)}`);
  expect(m.cells.length, `${who} ${w}: bet cells`).toBeGreaterThan(2);
  expect(m.cells.filter((c) => c.wrapped), `${who} ${w}: wrapped`).toHaveLength(0);
  expect(m.cells.filter((c) => c.leadingDot)).toHaveLength(0);
  expect(Math.max(...m.cells.map((c) => c.row)), `${who} ${w}: tallest row`).toBeLessThanOrEqual(58);
  expect(m.over, `${who} ${w}: sideways scroll`).toBe(0);
  expect(m.cls, `${who} ${w}: CLS`).toBeLessThan(0.05);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(500);
  expect(Math.round(await page.locator("table thead").evaluate((el) => el.getBoundingClientRect().top)), `${who} ${w}: sticky header`).toBe(64);
}

test("/markets: Free and Pro, Bet does not wrap at 1440 and 1920", async ({ page }) => {
  test.setTimeout(400_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `bet-wide-${Date.now()}` });
  await page.addInitScript(() => {
    const x = window as unknown as { __cls: number };
    x.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) x.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await signIn(page, `bet-wide-${Date.now()}@example.com`);
  for (const w of [1440, 1920]) await measure(page, "Free", w);
  await page.goto("/pricing");
  await page.getByTestId("checkout-pro").click();
  await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
  await expectPlanActive(page);
  for (const w of [1440, 1920]) await measure(page, "Pro", w);
});
