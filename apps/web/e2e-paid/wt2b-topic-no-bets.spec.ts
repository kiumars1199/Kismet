// T-wt2b (walk-through 2): a new Free user whose only topic has NO best bets today still gets a full first screen: today's 10 free
// bets under an h1 that says so, a filter bar that describes the cards, the "Your topics" pill, and a tour that opens over a card
// without scrolling the h1 away. And a plain topic filter says "this filter", not "your topics", with the locked card in view.
import { expect, test, type Page } from "./fixtures";

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
const CANDIDATES = ["sports.nba", "sports.nhl", "sports.mlb", "sports.tennis", "sports.golf", "sports.f1", "sports.mma", "crypto.btc", "crypto.eth", "politics.us", "finance.fed", "culture.movies"];

/** A topic with no best bets at all today (Free's /api/flags says total 0). Found from the data. */
async function zeroTopic(page: Page) {
  for (const t of CANDIDATES) {
    const r = (await (await page.request.get(`/api/flags?t=${encodeURIComponent(t)}`)).json()) as Flags;
    if (r.free_daily !== undefined && r.total === 0) return t;
  }
  return null;
}
/** A topic with bets, but none in this user's Free sample today. */
async function emptyTopic(page: Page) {
  const all = (await (await page.request.get("/api/flags")).json()) as Flags;
  for (const t of Object.keys(all.facets.topics).slice(0, 60)) {
    const r = (await (await page.request.get(`/api/flags?t=${encodeURIComponent(t)}`)).json()) as Flags;
    if (r.free_daily !== undefined && r.total > 0 && r.rows.length === 0) return { t, total: r.total };
  }
  return null;
}
const setTopics = async (page: Page, topic: string) => {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { favorite_topics: [topic] },
  });
  expect(res.status()).toBeLessThan(300);
};
const watchCls = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};

for (const { w, h } of SIZES) {
  test(`new Free user, only topic has no best bets today, at ${w}px: 10 cards under a matching h1, honest filter bar, pill kept, tour over a card, CLS < 0.1`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(watchCls);
    await signUp(page, `wt2b-zero-${w}-${Date.now()}@example.com`);
    const topic = await zeroTopic(page);
    expect(topic, "a topic with no best bets today").not.toBeNull();
    await setTopics(page, topic!);
    await page.getByRole("button", { name: "Skip setup" }).click();   // finishing lands on Best bets filtered to the chosen topics
    await page.waitForURL(/fav=1/, { timeout: 60_000 });

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText(/^No best bets in .+ today\. Here are today's free bets\.$/, { timeout: 60_000 });
    await expect(page.locator("article[data-row]").first()).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("article[data-row]").count(), "today's 10 free bets").toBe(10);
    // the filter bar describes the cards: no topic chip, a count of the bets shown
    await expect(page.getByTestId("bar-sport")).toHaveValue("");
    await expect(page.getByTestId("bar-count")).toHaveText(/^Showing 10 of /);
    await expect(page.getByRole("link", { name: "Remove filter: Your topics" })).toBeVisible();   // the pill stays

    // the tour's first step opens over a card, and the h1 that explains the screen stays in view
    const tour = page.getByRole("dialog", { name: "A best bet" });
    await expect(tour).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    // T-wt2f: the spotlit card is visible, the tour card neither covers it nor sits under the phone tab bar; at 1440 the heading stays in view
    const spot = (await page.getByTestId("tour-spot").boundingBox())!;
    const tcard = (await tour.boundingBox())!;
    const nav = page.locator('nav.fixed[aria-label="Main"]');
    const navTop = (await nav.isVisible()) ? (await nav.boundingBox())!.y : h;
    expect(spot.y + 6, "the spotlit card's top is on screen").toBeGreaterThanOrEqual(0);
    if (w < 1024) expect(spot.y + spot.height - 6, "the spotlit card ends above the tab bar").toBeLessThanOrEqual(navTop + 0.5);
    else expect(navTop - (spot.y + 6), "at 1440 the heading wins: at least 120 px of the card shows").toBeGreaterThanOrEqual(120);
    expect(tcard.y + tcard.height, "the tour card is above the tab bar").toBeLessThanOrEqual(navTop + 0.5);
    const hit = Math.min(spot.x + spot.width - 6, tcard.x + tcard.width) - Math.max(spot.x + 6, tcard.x) > 0 && Math.min(spot.y + spot.height - 6, tcard.y + tcard.height) - Math.max(spot.y + 6, tcard.y) > 0;
    expect(hit, "the tour card does not cover the card it points at").toBe(false);
    if (w >= 1024) {
      const box = (await h1.boundingBox())!;
      expect(box.y, "the h1 is not scrolled off the top").toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, "the h1 is on screen").toBeLessThanOrEqual(h);
    }
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`first screen at ${w}px: CLS ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.1);
  });

  test(`plain topic filter (no 'Your topics') at ${w}px: neutral h1, the locked card is in the first view and reads naturally`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt2b-plain-${w}-${Date.now()}@example.com`);
    const found = await emptyTopic(page);
    expect(found, "a topic with bets but none in this user's sample").not.toBeNull();
    await page.getByRole("button", { name: "Skip setup" }).click();
    await page.waitForURL(/\/(bets)?(\?|$)/, { timeout: 60_000 });
    await page.goto(`/?view=flags&t=${encodeURIComponent(found!.t)}`);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText(/^Today's free bets aren't in .+$/, { timeout: 60_000 });
    expect(await h1.innerText()).not.toMatch(/your topics/i);
    const locked = page.getByTestId("locked-bets");
    await expect(locked).toBeVisible();
    await expect(locked).toContainText(new RegExp(`Pro shows the ${found!.total === 1 ? "1 bet" : `${found!.total.toLocaleString("en-US")} bets`} in .+, live\\.`));
    expect(await locked.innerText()).not.toMatch(/Pro shows all/);
    const b = (await locked.boundingBox())!;
    expect(b.y + b.height, `the locked card is inside the first view (${h}px)`).toBeLessThanOrEqual(h);
  });
}
