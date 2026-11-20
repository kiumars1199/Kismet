// T-291 #12, #14: with billing configured, the plan buttons are right in the first HTML: no disabled "Coming soon"
// waiting for /api/me, and "Start free" goes to /signup.
import { expect, test } from "@playwright/test";

test("plan buttons in the server HTML: Start trial / Start free, never a disabled Coming soon", async ({ request, page }) => {
  for (const path of ["/pricing", "/about", "/"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(/<button[^>]*disabled[^>]*>Coming soon/);
    expect(html, path).toMatch(/<a[^>]*href="\/signup\?next=\/pricing"[^>]*>Start trial</);
    expect(html, path).toMatch(/<a[^>]*href="\/signup"[^>]*>Start free</);
  }
  // and nothing flips to it after hydration
  await page.goto("/pricing");
  await expect(page.getByRole("link", { name: "Start trial" })).toHaveCount(2);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Coming soon" })).toHaveCount(0);
  await page.getByRole("link", { name: "Start free" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});
