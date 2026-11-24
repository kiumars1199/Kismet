// T-wt2f (walk-through 2): every tour step's target is on screen, above the phone tab bar and clear of the tour card, at 390 and 1440,
// for a Free user with cards on the page and for one whose only topic has no best bets today (free-bets fallback). Step 1's copy matches the card
// ("Pays 1.45x", not "$10 wins"). The check-your-email screen offers "Log in" once. Onboarding's sticky bar is solid down to the tab bar.
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

/** Evidence screenshots (EVIDENCE_DIR=docs/launch/review/wt2f), at deviceScaleFactor 1. */
const shot = async (page: Page, name: string) => { if (process.env.EVIDENCE_DIR) await page.screenshot({ path: `${process.env.EVIDENCE_DIR}/${page.viewportSize()!.width}-${name}.png` }); };

const SIZES = [{ w: 390, h: 844 }, { w: 1440, h: 900 }];
const CANDIDATES = ["sports.nba", "sports.nhl", "sports.mlb", "sports.tennis", "sports.golf", "sports.f1", "sports.mma", "crypto.btc", "crypto.eth", "politics.us", "finance.fed", "culture.movies"];
type Flags = { total: number; free_daily?: number };
async function zeroTopic(page: Page) {
  for (const t of CANDIDATES) {
    const r = (await (await page.request.get(`/api/flags?t=${encodeURIComponent(t)}`)).json()) as Flags;
    if (r.free_daily !== undefined && r.total === 0) return t;
  }
  return null;
}
async function setTopics(page: Page, topic: string) {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { favorite_topics: [topic] },
  });
  expect(res.status()).toBeLessThan(300);
}

/** Walk the five steps; each spotlight must be fully inside the viewport, above the tab bar, and not covered by the tour card. */
async function walk(page: Page, label: string) {
  const dialog = page.getByTestId("tour").getByRole("dialog");
  await expect(page.getByRole("dialog", { name: "A best bet" })).toBeVisible({ timeout: 60_000 });
  const vh = page.viewportSize()!.height;
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`${i} of 5`)).toBeVisible();
    await page.waitForTimeout(900);   // the scroll and the 300 ms glide settle
    const spot = await page.getByTestId("tour-spot").boundingBox();
    const card = (await dialog.boundingBox())!;
    const nav = page.locator('nav.fixed[aria-label="Main"]');
    const navTop = (await nav.isVisible()) ? (await nav.boundingBox())!.y : vh;
    expect(spot, `${label} step ${i}: a spotlight`).not.toBeNull();
    const s = spot!;
    // the ring is the target plus 6 px padding; the target itself must be in view
    expect(s.y + 6, `${label} step ${i}: target top in view`).toBeGreaterThanOrEqual(0);
    expect(s.y + s.height - 6, `${label} step ${i}: target above the tab bar (${navTop})`).toBeLessThanOrEqual(navTop);
    const overlap = Math.min(s.x + s.width - 6, card.x + card.width) - Math.max(s.x + 6, card.x) > 0 && Math.min(s.y + s.height - 6, card.y + card.height) - Math.max(s.y + 6, card.y) > 0;
    expect(overlap, `${label} step ${i}: the tour card does not cover the target (target y ${s.y + 6}-${s.y + s.height - 6}, tour card y ${card.y}-${card.y + card.height}, tab bar ${navTop})`).toBe(false);
    await shot(page, `tour-${label.replace(" ", "-")}-${i}`);
    if (i === 1) await expect(dialog).not.toContainText("$10");
    if (i < 5) await page.getByTestId("tour").getByRole("button", { name: "Next", exact: true }).click();
  }
}

for (const { w, h } of SIZES) {
  for (const zero of [false, true]) {
    test(`tour targets stay on screen at ${w}px, ${zero ? "free-bets fallback" : "cards"}`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.setViewportSize({ width: w, height: h });
      await signUp(page, `wt2f-${zero ? "z" : "c"}-${w}-${Date.now()}@example.com`);
      if (zero) {
        const topic = await zeroTopic(page);
        expect(topic).not.toBeNull();
        await setTopics(page, topic!);
      }
      await page.getByRole("button", { name: "Skip setup" }).click();
      await page.waitForURL(/\/(bets|\?|$)|fav=1/, { timeout: 60_000 });
      await expect(page.locator("article[data-row]").first()).toBeVisible({ timeout: 60_000 });
      await walk(page, zero ? "zero" : "cards");
    });
  }
}

test("check-your-email offers Log in once; onboarding's sticky bar meets the tab bar", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await expect(async () => {
    await page.getByRole("tab", { name: "Password" }).click();
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Email", { exact: true }).fill(`wt2f-pw-${Date.now()}@example.com`);
  await page.locator('input[type="password"]').fill("correct-horse-9");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Create/ }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  expect(await page.getByText("Already have an account?").count(), "one \"Already have an account?\" on the check-your-email screen").toBe(1);
  await shot(page, "check-email-390");
  await signUp(page, `wt2f-bar-${Date.now()}@example.com`);
  await shot(page, "onboarding-1-390");
  const bar = page.locator("div.sticky.bottom-0").filter({ has: page.getByRole("button", { name: "Next" }) });
  await expect(bar).toBeVisible();
  const nav = (await page.locator('nav.fixed[aria-label="Main"]').boundingBox())!;
  const b = (await bar.boundingBox())!;
  expect(b.y + b.height, "the bar's solid background reaches the tab bar").toBeGreaterThanOrEqual(nav.y - 0.5);
  const next = (await page.getByRole("button", { name: "Next" }).boundingBox())!;
  expect(next.y + next.height, "Next stays above the tab bar").toBeLessThanOrEqual(nav.y);
});
