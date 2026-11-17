// S7 (docs/12): sign up → upgrade (Stripe mocked) → gated feature unlocks. Plus account delete.
// Supabase and Stripe are the in-app mock (app/e2e-mock); the magic link is read from its inbox.
import { expect, test, type Page } from "@playwright/test";
import type { MarketsResponse } from "@/lib/api";

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/pricing");
  await page.getByLabel("Email").fill(email);
  await expect(page.locator("input[type=checkbox]:invalid")).toHaveCount(1);   // 18+/Terms is required
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });   // first call compiles the route
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  expect(url).toContain("/auth/callback");
  await page.goto(url);
  await expect(page).toHaveURL(/\/onboarding/);   // first sign-in: onboarding, then Best bets
  // On a cold dev server the click can land before hydration; retry until the navigation happens.
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("button", { name: "Skip setup" }).click();
    await expect(page).toHaveURL(/:\d+\/(\?|$)/, { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
}

const rows = async (page: Page) => (await (await page.request.get("/api/markets?ps=200")).json()) as MarketsResponse;

test("S7 sign up → upgrade with Stripe → Pro unlocks live data and exact numbers", async ({ page }) => {
  const email = `s7-${Date.now()}@example.com`;
  await signIn(page, email);

  const free = await rows(page);
  expect(free.rows).toHaveLength(25);
  expect(free.rows[0].side.ranges).toBeDefined();
  expect((await (await page.request.get("/api/me")).json()).tier).toBe("free");

  await page.goto("/pricing");
  await page.getByTestId("checkout-pro").click();
  await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });   // checkout → mock Stripe → signed webhooks
  await expect(page.getByTestId("checkout-status")).toHaveText("Payment confirmed. Your plan is active.");
  await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();

  const pro = await rows(page);
  expect(pro.rows.length).toBeGreaterThan(25);
  expect(pro.rows.every((r) => r.side.ranges === undefined)).toBe(true);
  await page.goto("/pricing");
  await expect(page.getByTestId("checkout-pro")).toHaveCount(0);   // "Your plan" instead of a second checkout

  // Deleting a paying account cancels the Stripe subscription first (a failed cancel blocks the delete).
  await page.goto("/account");
  await page.getByRole("button", { name: "Delete account…" }).click();
  await page.getByLabel(`Type ${email} to confirm`).fill(email);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/\?deleted=1/, { timeout: 30_000 });
  expect((await (await page.request.get("/api/me")).json()).user).toBeNull();
});

test("account delete: type the email, everything goes, signed out", async ({ page }) => {
  const email = `del-${Date.now()}@example.com`;
  await signIn(page, email);
  await page.goto("/account");
  await page.getByRole("button", { name: "Delete account…" }).click();
  const confirm = page.getByRole("button", { name: "Delete permanently" });
  await page.getByLabel(`Type ${email} to confirm`).fill("someone-else@example.com");
  await expect(confirm).toBeDisabled();
  await page.getByLabel(`Type ${email} to confirm`).fill(email);
  await confirm.click();
  await expect(page).toHaveURL(/\/\?deleted=1/);
  const me = await (await page.request.get("/api/me")).json();
  expect(me.user).toBeNull();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});
