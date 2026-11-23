// /markets at 768 scrolled the whole page sideways: the table (md and up) is 1294 px wide and nothing contained it, so document
// scrollWidth was 1294 for every signed-in plan. The page must never scroll sideways at 390, 768 or 1024, and the page shift on load
// stays under 0.1.
import { expect, test, type Page } from "./fixtures";

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


for (const w of [390, 768, 1024]) {
  test(`/markets signed in: the page does not scroll sideways at ${w}px, CLS < 0.1`, async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page, `f-table-${w}-${Date.now()}@example.com`);
    await page.setViewportSize({ width: w, height: 900 });
    await page.addInitScript(() => {
      const x = window as unknown as { __cls: number };
      x.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) x.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/markets");
    await expect(page.locator("[data-row], table tbody tr").first()).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, cls: (window as unknown as { __cls: number }).__cls }));
    console.log(`/markets ${w}px: scrollWidth ${m.sw}, innerWidth ${m.iw}, CLS ${m.cls.toFixed(4)}`);
    expect(m.sw).toBeLessThanOrEqual(m.iw);
    expect(m.cls).toBeLessThan(0.1);
  });
}
