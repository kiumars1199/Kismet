// F5: pick topics at signup. New account picks NFL + Politics -> / and /bets open filtered with a visible "Your topics"
// pill that clears in one tap (and stays cleared). Skipping setup leaves the views unfiltered. Filters only, never picks.
import path from "node:path";
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

/** Free's Best bets are a random daily sample, so a topic filter can leave it empty. These tests are about the filter and
 *  the layout, so the new account gets a Premium comp through the mock database (service role): every matching bet lists. */
async function makePremium(page: Page) {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" },
  });
  expect(res.status()).toBeLessThan(300);
  expect((await (await page.request.get("/api/me")).json()).tier).toBe("premium");
}

const pill = (page: Page) => page.getByRole("button", { name: "Remove filter: Your topics" });

const SHOTS = path.resolve(process.cwd(), "../../docs/launch/review/f05");   // repo-relative: <repo>/docs/launch/review/f05
const SIZES = [{ w: 390, h: 844 }, { w: 1440, h: 900 }];

/** Sum of layout-shift entries (input-driven shifts excluded) since the last resetCls(); survives client navigation. */
async function observeCls(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
}
const resetCls = (page: Page) => page.evaluate(() => { (window as unknown as { __cls: number }).__cls = 0; });
const readCls = async (page: Page) => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1_500); return page.evaluate(() => (window as unknown as { __cls: number }).__cls); };

// next dev compiles a route on its first hit (seconds of unstyled, shifting layout). This throwaway user hits the routes
// the measured tests land on, so those measure the page, not the compiler.
test("warm-up: first hits compile the routes", async ({ page }) => {
  test.setTimeout(300_000);
  await signUp(page, `f05-warm-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 120_000 });
  for (const u of ["/bets", "/bets?fav=1&t=sports.nfl", "/settings", "/account"]) { await page.goto(u); await page.waitForLoadState("networkidle"); }
});

for (const { w, h } of SIZES) {
  test(`picks NFL + Politics at ${w}px: / and /bets open filtered with a Your topics pill; one tap clears it`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await observeCls(page);
    await signUp(page, `f05-pick-${w}-${Date.now()}@example.com`);
    await makePremium(page);
    const nfl = page.getByRole("button", { name: /^NFL/ });
    const politics = page.getByRole("button", { name: /^Elections/ });   // Politics & Elections > Elections: the fixture's one open Politics market
    await expect(nfl).toContainText("open", { timeout: 60_000 });   // the tile counts arrive after first paint and move the grid
    await page.waitForTimeout(500);
    await nfl.click();   // each tap waits for the account store, then saves; the tile shows chosen once it has
    await expect(nfl).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
    await politics.click();
    await expect(politics).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/${w}-1-pick-topics.png` });
    await resetCls(page);   // measure the exact landing after onboarding
    await page.getByRole("button", { name: "Skip setup" }).click();   // finishing from any step saves; lands on Best bets
    await expect(page).toHaveURL(/fav=1/, { timeout: 60_000 });
    await expect(pill(page)).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("article[data-row]").count()).toBeGreaterThan(0);
    const landing = await readCls(page);
    console.log(`CLS post-onboarding landing at ${w}px: ${landing.toFixed(4)}  (${page.url()})`);
    expect(landing).toBeLessThan(0.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);   // no horizontal scroll

    // a later visit to / and /bets: a real 307 (no page body), then ONE document that already holds the pill and the cards
    for (const route of ["/", "/bets"]) {
      const hop = await page.request.get(route, { maxRedirects: 0 });
      expect(hop.status(), route).toBe(307);
      expect(hop.headers().location, route).toMatch(/\/bets\?fav=1&t=/);
      expect((await hop.text()).length, "the 307 carries no page").toBeLessThan(2_000);
      const doc = await page.request.get(route);   // follows the redirect
      expect(doc.status()).toBe(200);
      expect(doc.url()).toMatch(/fav=1&t=/);
      const html = await doc.text();
      expect(html).not.toContain("NEXT_REDIRECT");
      expect(html).toContain("Remove filter: Your topics");
      expect(html).toMatch(/<article[^>]*data-row/);
      await page.goto(route);
      await expect(page).toHaveURL(/fav=1/);
      await expect(pill(page)).toBeVisible({ timeout: 30_000 });
    }
    await page.getByRole("button", { name: "Skip tour" }).click({ timeout: 30_000 });   // the first-run tour covers the page
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/${w}-2-bets-filtered.png` });

    // CLS of a fresh /bets load with topics saved (spec: < 0.1)
    await resetCls(page);
    await page.goto("/bets");
    await expect(pill(page)).toBeVisible({ timeout: 30_000 });
    const shift = await readCls(page);
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

// Round 2: the profile is the source of truth; the me_topics cookie is a short hint bound to the user.
test("topics cleared elsewhere stop filtering here; sign-out drops the hint; another account never reads it", async ({ page, context }) => {
  test.setTimeout(300_000);
  await signUp(page, `f05-stale-${Date.now()}@example.com`);
  await makePremium(page);
  const nfl = page.getByRole("button", { name: /^NFL/ });
  await expect(nfl).toContainText("open", { timeout: 60_000 });
  await page.waitForTimeout(500);
  await nfl.click();
  await expect(nfl).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL(/fav=1/, { timeout: 60_000 });
  const hint = async () => (await context.cookies()).find((c) => c.name === "me_topics");
  const me = await (await page.request.get("/api/me")).json();
  expect(decodeURIComponent((await hint())!.value)).toMatch(new RegExp(`^${me.user.id}\\|on:sports\\.nfl`));   // bound to the user

  // "device 2" clears the topics in the profile; this device still holds the old hint until it next asks the server
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { favorite_topics: [] },
  });
  expect(res.status()).toBeLessThan(300);
  await page.request.get("/api/me");   // every page load polls this: the hint is rewritten from the profile
  expect(decodeURIComponent((await hint())!.value)).toMatch(/\|on:$/);
  expect((await page.request.get("/bets", { maxRedirects: 0 })).status()).toBe(200);

  // a hint written for another user is ignored on this account
  await context.addCookies([{ name: "me_topics", value: encodeURIComponent("someone-else|on:sports.nfl"), url: new URL(page.url()).origin }]);
  expect((await page.request.get("/bets", { maxRedirects: 0 })).status()).toBe(200);

  // sign-out drops it
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.goto("/");   // a signed-out page request drops any hint a request that was in flight at sign-out wrote
  await page.waitForLoadState("networkidle");
  expect(await hint()).toBeUndefined();
});

test("a returning user's first /bets opens filtered (the hint outlives the tab)", async ({ page, context }) => {
  test.setTimeout(300_000);
  await signUp(page, `f05-return-${Date.now()}@example.com`);
  await makePremium(page);
  const nfl = page.getByRole("button", { name: /^NFL/ });
  await expect(nfl).toContainText("open", { timeout: 60_000 });
  await page.waitForTimeout(500);
  await nfl.click();
  await expect(nfl).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL(/fav=1/, { timeout: 60_000 });
  await page.goto("about:blank");   // no Kismet tab open: nothing polls /api/me
  const hint = (await context.cookies()).find((c) => c.name === "me_topics")!;
  expect((hint.expires - Date.now() / 1000) / 86_400).toBeGreaterThan(300);   // lasts about a year, not minutes
  const hop = await page.request.get("/bets", { maxRedirects: 0 });
  expect(hop.status()).toBe(307);
  expect(hop.headers().location).toMatch(/\/bets\?fav=1&t=sports\.nfl/);
});
