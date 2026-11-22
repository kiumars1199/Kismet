import { expect, type Page } from "@playwright/test";

/**
 * After mock Stripe lands on /account?checkout=success: wait until the plan is active.
 * CheckoutStatus shows "Payment confirmed" only when /api/me already says paid on its first load. If its 2 s poll
 * sees the plan change instead, it reloads plain /account, which has no status line. Both mean the plan is active
 * (Nov 22: waiting only for the text failed on CI whenever the poll won the race). The page gives up after 60 s.
 */
export async function expectPlanActive(page: Page) {
  await expect(async () => {
    const u = new URL(page.url());
    if (u.pathname === "/account" && !u.search) return;
    await expect(page.getByTestId("checkout-status")).toHaveText("Payment confirmed. Your plan is active.", { timeout: 1_000 });
  }).toPass({ timeout: 70_000 });
}
