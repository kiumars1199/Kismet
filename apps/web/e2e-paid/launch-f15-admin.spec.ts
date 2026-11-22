// F15: /admin "Last 30 days": daily sign-ups, trials, payments, revenue in dollars, cancellations and invites.
// Supabase is the in-app mock (admin_metrics is mirrored in app/e2e-mock). Non-admins still get a 404 (admin.spec.ts).
import { expect, test, type Page } from "@playwright/test";

const ADMIN = "admin-e2e@example.com";   // playwright.paid.config.ts ADMIN_EMAILS

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

test("admin 30-day table: counts, dollars from cents, dashes before the ledger", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, ADMIN);
  const now = new Date().toISOString();
  // two payments today ($19.99 + $11.99), one $0 trial invoice (not a payment), one cancellation
  for (const [id, type, amount_cents] of [["e1", "invoice.paid", 1999], ["e2", "invoice.paid", 1199], ["e3", "invoice.paid", 0], ["e4", "customer.subscription.deleted", null]] as const) {
    const res = await page.request.post("/e2e-mock/supabase/rest/v1/stripe_events", {
      headers: { authorization: "Bearer e2e-service", "content-type": "application/json" },
      data: { id: `f15-${id}`, type, processed_at: now, amount_cents },
    });
    expect(res.ok(), id).toBe(true);
  }

  await page.goto("/admin");
  const m = page.getByTestId("admin-metrics");
  await expect(m).toBeVisible();
  const today = m.locator("tbody tr").first();
  await expect(today.getByTestId("admin-day-revenue")).toHaveText("$31.98");   // dollars, never cents
  await expect(today.locator("td").nth(2)).toHaveText("2");   // payments: the $0 invoice is not one
  await expect(today.locator("td").nth(4)).toHaveText("1");   // canceled
  await expect(today.locator("td").nth(0)).toHaveText(/^[1-9]/);   // the admin signed up today
  await expect(m.getByTestId("admin-revenue-30d")).toHaveText("$31.98");
  await expect(m.getByTestId("admin-payments-30d")).toHaveText("2");

  // 30 rows, newest first; days before the ledger began are a dash, not $0.00
  await expect(m.locator("tbody tr")).toHaveCount(30);
  await expect(m.locator("tbody tr").last().getByTestId("admin-day-revenue")).toHaveText("—");
  await expect(m.locator("tbody tr").last()).toHaveAttribute("data-day", /^\d{4}-\d{2}-\d{2}$/);
  await expect(m.getByTestId("admin-revenue-note")).toContainText("Revenue is recorded from");
  expect(await m.innerText()).not.toMatch(/\b\d{4,}\b cents|1999|1199/);   // raw cents never shown

  // 390 px: no page-level horizontal scroll (the table scrolls inside its box)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByTestId("admin-metrics")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
