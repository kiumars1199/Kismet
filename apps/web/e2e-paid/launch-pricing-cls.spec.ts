// /pricing layout shift stays under 0.1 at 390 and 1440 for a signed-out visitor, a Free account and a Pro account
// (the Details expand and the plan buttons that wait for /api/me must not move the plans). Supabase/Stripe: the in-app mock.
import { expect, test, type Page } from "@playwright/test";
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


async function clsOf(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/account");   // a fresh document each time: the observer below starts with it
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Plans", exact: true, level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000);
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

test("/pricing CLS < 0.1 at 390 and 1440: signed out, Free, Pro", async ({ page }) => {
  test.setTimeout(400_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `cls-${Date.now()}` });
  await page.addInitScript(() => {
    const win = window as unknown as { __cls: number };
    win.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) win.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  const seen: string[] = [];
  const measure = async (who: string) => {
    for (const [w, h] of [[390, 844], [1440, 900]] as const) {
      const c = await clsOf(page, w, h);
      seen.push(`${who} ${w}: ${c.toFixed(4)}`);
      expect(c, `${who} at ${w}`).toBeLessThan(0.1);
    }
  };
  await measure("signed out");
  await signIn(page, `pricing-cls-${Date.now()}@example.com`);
  await measure("Free");
  await page.goto("/pricing");
  await page.getByTestId("checkout-pro").click();
  await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
  await expectPlanActive(page);
  await measure("Pro");
  console.log(`CLS /pricing: ${seen.join(" | ")}`);
});
