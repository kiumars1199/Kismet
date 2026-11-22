// F5: pick topics at signup. New account picks NFL + Politics -> / and /bets open filtered with a visible "Your topics"
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

const SHOTS = "/home/user/MarketEdge/.claude/worktrees/agent-afda8a27944e228d2/docs/launch/review/f05";
const SIZES = [{ w: 390, h: 844 }, { w: 1440, h: 900 }];

/** Layout shift of the next full load of `path`, from buffered layout-shift entries (input-driven shifts excluded). */
async function cls(page: Page, path: string) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(path);
  await expect(pill(page)).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1_500);
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

for (const { w, h } of SIZES) {
  test(`picks NFL + Politics at ${w}px: / and /bets open filtered with a Your topics pill; one tap clears it`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `f05-pick-${w}-${Date.now()}@example.com`);
    const nfl = page.getByRole("button", { name: /^NFL/ });
    const politics = page.getByRole("button", { name: /^Elections/ });   // Politics & Elections > Elections: the fixture's one open Politics market
    await nfl.click();   // each tap waits for the account store, then saves; the tile shows chosen once it has
    await expect(nfl).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
    await politics.click();
    await expect(politics).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/${w}-1-pick-topics.png` });
    await page.getByRole("button", { name: "Skip setup" }).click();   // finishing from any step saves; lands on Best bets
    await expect(page).toHaveURL(/fav=1/, { timeout: 60_000 });
    await expect(pill(page)).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);   // no horizontal scroll

    // a later visit to / and /bets: the server redirects before rendering, so the pill is in the first HTML
    for (const path of ["/", "/bets"]) {
      const res = await page.request.get(path, { maxRedirects: 0 });
      expect([200, 307, 308]).toContain(res.status());
      await page.goto(path);
      await expect(page).toHaveURL(/fav=1/);
      await expect(pill(page)).toBeVisible({ timeout: 30_000 });
    }
    await page.getByRole("button", { name: "Skip tour" }).click({ timeout: 30_000 });   // the first-run tour covers the page
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/${w}-2-bets-filtered.png` });

    // CLS of a fresh /bets load with topics saved (spec: < 0.1)
    const shift = await cls(page, "/bets");
    console.log(`CLS /bets with topics saved at ${w}px: ${shift.toFixed(4)}`);
    expect(shift).toBeLessThan(0.1);
    await page.waitForLoadState("networkidle");
    const skip = page.getByRole("button", { name: "Skip tour" });
    if (await skip.isVisible()) await skip.click();

    // one tap clears it, saved to the account: the next visit stays unfiltered
    await pill(page).click();   // the pill is in the server HTML; networkidle above means it is hydrated
    await expect(page).not.toHaveURL(/fav=1/);
    await expect(pill(page)).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/${w}-3-cleared.png` });
    await page.goto("/bets");
    await expect(page).not.toHaveURL(/fav=1/);
    await expect(pill(page)).toHaveCount(0);
  });
}

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
