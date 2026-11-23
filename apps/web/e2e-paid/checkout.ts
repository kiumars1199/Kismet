import { expect, type Page } from "@playwright/test";

/**
 * After mock Stripe lands on /account?checkout=success: wait until the plan is active.
 * CheckoutStatus shows "Payment confirmed" when /api/me already says paid on its first load. If its 2 s poll
 * sees the plan change instead, it reloads plain /account, which has no status line. Both mean the plan is active
 * (Nov 22: waiting only for the text failed on CI whenever the poll won the race). The page gives up after 60 s.
 * When the poll wins, the same tick shows "Payment confirmed" and starts that reload, so seeing the text doesn't mean
 * the page is settled: wait for the app's own redirect too, or a goto right after races it (Nov 23 CI: ERR_ABORTED).
 */
const PLAIN_ACCOUNT = (u: URL) => u.pathname === "/account" && !u.search;
export async function expectPlanActive(page: Page) {
  await expect(async () => {
    if (PLAIN_ACCOUNT(new URL(page.url()))) return;
    await expect(page.getByTestId("checkout-status")).toHaveText("Payment confirmed. Your plan is active.", { timeout: 1_000 });
  }).toPass({ timeout: 70_000 });
  // Paid on first load: no reload comes, and the URL keeps ?checkout=success after this wait.
  await page.waitForURL(PLAIN_ACCOUNT, { timeout: 10_000 }).catch((e: Error) => { if (e.name !== "TimeoutError") throw e; });
}
