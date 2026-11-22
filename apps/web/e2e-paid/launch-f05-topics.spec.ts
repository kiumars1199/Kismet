// F5: pick topics at signup. New account picks NFL + NBA -> / and /bets open filtered with a visible "Your topics"
// pill that clears in one tap (and stays cleared). Skipping setup leaves the views unfiltered. Filters only, never picks.
import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page, email: string) {
  await page.goto("/login");
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
  await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
}

const pill = (page: Page) => page.getByRole("button", { name: "Remove filter: Your topics" });

test("picks NFL + NBA: / and /bets open filtered with a Your topics pill; one tap clears it", async ({ page }) => {
  test.setTimeout(300_000);
  await signUp(page, `f05-pick-${Date.now()}@example.com`);
  const nfl = page.getByRole("button", { name: /^NFL/ });
  const nba = page.getByRole("button", { name: /^NBA/ });
  await nfl.click();   // each tap waits for the account store, then saves; the tile shows chosen once it has
  await expect(nfl).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  await nba.click();
  await expect(nba).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Skip setup" }).click();   // finishing from any step saves; lands on Best bets
  await expect(page).toHaveURL(/fav=1/, { timeout: 60_000 });
  await expect(pill(page)).toBeVisible({ timeout: 30_000 });

  // a later visit to / and /bets: the server redirects before rendering, so the pill is in the first HTML
  for (const path of ["/", "/bets"]) {
    const res = await page.request.get(path, { maxRedirects: 0 });
    expect([200, 307, 308]).toContain(res.status());
    await page.goto(path);
    await expect(page).toHaveURL(/fav=1/);
    await expect(pill(page)).toBeVisible({ timeout: 30_000 });
  }

  // one tap clears it, saved to the account: the next visit stays unfiltered
  await page.getByRole("button", { name: "Skip tour" }).click({ timeout: 30_000 });   // the first-run tour covers the page
  await page.waitForLoadState("networkidle");   // the pill is in the server HTML; a tap before hydration does nothing
  await pill(page).click();
  await expect(page).not.toHaveURL(/fav=1/);
  await expect(pill(page)).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await page.goto("/bets");
  await expect(page).not.toHaveURL(/fav=1/);
  await expect(pill(page)).toHaveCount(0);
});

test("skipping setup keeps / and /bets unfiltered; topics are editable in /settings", async ({ page }) => {
  test.setTimeout(300_000);
  await signUp(page, `f05-skip-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/fav=1/);
  await expect(pill(page)).toHaveCount(0);
  await page.goto("/bets");
  await expect(page).not.toHaveURL(/fav=1/);
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: /^NFL/ })).toBeVisible({ timeout: 30_000 });
});
