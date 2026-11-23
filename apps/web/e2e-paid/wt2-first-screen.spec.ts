// Walk-through 2 dry run: a new Free user's first screens.
//  1. The topics they pick can have none of today's Free sample: the first screen shows today's free bets under a plain
//     heading (cards, not just words), and the topic pill stays.
//  2. The tour's first step opens over a card, never over an empty list.
//  3. Onboarding step 1 does not shift when the "N open" counts arrive (CLS < 0.05).
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

const SIZES = [{ w: 390, h: 844 }, { w: 1440, h: 900 }];
type Flags = { rows: unknown[]; total: number; free_daily?: number; facets: { topics: Record<string, number> } };

/** A topic that has bets but none in this user's Free sample today. Found from the data, not hard-coded. */
async function emptyTopic(page: Page) {
  const all = (await (await page.request.get("/api/flags")).json()) as Flags;
  for (const t of Object.keys(all.facets.topics).slice(0, 60)) {
    const r = (await (await page.request.get(`/api/flags?t=${encodeURIComponent(t)}`)).json()) as Flags;
    if (r.free_daily !== undefined && r.total > 0 && r.rows.length === 0) return t;
  }
  return null;
}

for (const { w, h } of SIZES) {
  test(`new Free user, topics with none of today's sample, at ${w}px: free bets under a plain heading, pill kept, tour over a card`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt2-free-${w}-${Date.now()}@example.com`);
    const topic = await emptyTopic(page);
    expect(topic, "a topic with no bets in this user's Free sample").not.toBeNull();
    const me = await (await page.request.get("/api/me")).json();
    const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}`, {
      headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { favorite_topics: [topic] },
    });
    expect(res.status()).toBeLessThan(300);
    await page.getByRole("button", { name: "Skip setup" }).click();   // finishing lands on Best bets filtered to the chosen topics
    await page.waitForURL(/fav=1/, { timeout: 60_000 });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("None of today's free bets are in your topics. Here are today's free bets.", { timeout: 60_000 });
    await expect(page.locator("article[data-row]").first()).toBeVisible({ timeout: 30_000 });   // the cards, not just the words
    expect(await page.locator("article[data-row]").count()).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Remove filter: Your topics" })).toBeVisible();   // the topic pill stays

    // tour step 1 ("A best bet") opens only over a rendered card
    const tour = page.getByRole("dialog", { name: "A best bet" });
    await expect(tour).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("article[data-row]").count(), "a card is on screen when the tour opens").toBeGreaterThan(0);
  });

  test(`onboarding step 1 at ${w}px: CLS < 0.05 once the counts arrive`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt2-cls-${w}-${Date.now()}@example.com`);
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; })
        .observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/onboarding");   // a fresh load: the counts are fetched after first paint
    await expect(page.getByText(/\d+ open/).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`CLS onboarding step 1 at ${w}px: ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.05);
  });
}
