// F1 (SPEC): Free account: the first check answers 200, a second check the same UTC day answers 429 { code: "check_limit" }
// (counted on the server, per account). Pro: 20 checks, all 200. Supabase/Stripe: the in-app mock.
import { expect, test, type Page } from "@playwright/test";
import { expectPlanActive } from "./checkout";

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/account");
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
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

/** Each test is its own device for the signed-out daily count (the server honors x-e2e-device only under E2E_MOCK, never in production). */
const ownDevice = (page: Page) => page.context().setExtraHTTPHeaders({ "x-e2e-device": `t-${Date.now()}-${Math.random().toString(36).slice(2)}` });

const marketIds = async (page: Page, n: number) => {
  const r = await page.request.get("/api/markets?limit=40");
  const ids = ((await r.json()).rows as { market: { id: string } }[]).map((x) => x.market.id);
  return [...new Set(ids)].slice(0, n);
};
const check = (page: Page, m: string) => page.request.post("/api/check", { data: { m, side: 0 }, headers: { Origin: new URL(page.url()).origin } });

test("Free: 1 check a day, the second is 429 check_limit; Pro: 20 checks all 200", async ({ page }) => {
  test.setTimeout(300_000);
  await ownDevice(page);
  await signIn(page, `f01-limit-${Date.now()}@example.com`);
  const ids = await marketIds(page, 20);
  expect(ids.length).toBeGreaterThanOrEqual(2);

  const first = await check(page, ids[0]!);
  expect(first.status()).toBe(200);
  expect((await first.json()).result.score).not.toBeUndefined();
  const second = await check(page, ids[1]!);
  expect(second.status()).toBe(429);
  expect((await second.json()).code).toBe("check_limit");

  // the page shows the upgrade card, not a number
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {   // the limit card keeps the skeleton's height: CLS < 0.1
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/check");
    await page.goto(`/check?m=${ids[1]}&side=0`);
    await expect(page.getByTestId("check-upgrade")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("chk-score")).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), `CLS at ${w}`).toBeLessThan(0.1);
  }

  await page.goto("/pricing");
  await page.getByTestId("checkout-pro").click();
  await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
  await expectPlanActive(page);
  for (let i = 0; i < 20; i++) expect((await check(page, ids[i % ids.length]!)).status()).toBe(200);
});

// Signed out (accounts on): /check?m= must not open the drawer, go inert, or redirect to /signup (components/market/DrawerGate.tsx).
test("signed out: /check?m=<id>&side=0 stays on /check", async ({ page }) => {
  await ownDevice(page);
  await page.goto("/check?m=6417673&side=0");   // a fixture market (test/fixtures/markets.json)
  await page.waitForTimeout(3_000);   // a redirect would have fired by now
  await expect(page).toHaveURL(/\/check\?m=/);
  await expect(page.getByRole("dialog", { name: "Market details" })).toHaveCount(0);
  expect(await page.locator("[inert]").count()).toBe(0);
  await expect(page.getByRole("heading", { name: "Bet checker" })).toBeVisible();
});

// Signed-out word search: a public, minimal lookup (id, title, side, payout multiplier only).
test("signed out: /api/check/search finds markets and leaks nothing else", async ({ page }) => {
  await ownDevice(page);
  const request = page.request;
  const r = await request.get("/api/check/search?q=nfl");
  expect(r.status()).toBe(200);
  const { markets } = await r.json();
  expect(markets.length).toBeGreaterThan(0);
  for (const m of markets) expect(Object.keys(m).sort()).toEqual(["id", "outcome", "pays", "question", "side_index"]);
  expect((await request.get("/api/check/search?q=a")).status()).toBe(400);
  await page.goto("/check");
  await page.getByLabel("Market link or words").fill("nfl");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByTestId("check-hits").locator("li").first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("check-hits").locator("li button").first().click();
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 30_000 });
});

// F2: a combo is ONE check, shared with F1's allowance; the leg lookup is not a check and carries no model numbers.
test("Free: scoring a combo uses the day's check; the same set is free; another combo and a single check get 429", async ({ page }) => {
  test.setTimeout(240_000);
  await ownDevice(page);
  await signIn(page, `f02-limit-${Date.now()}@example.com`);
  const ids = await marketIds(page, 4);
  expect(ids.length).toBeGreaterThanOrEqual(3);
  const post = (path: string, data: unknown) => page.request.post(path, { data, headers: { Origin: new URL(page.url()).origin } });

  // lookups are free and say nothing about the model
  for (const m of ids.slice(0, 3)) {
    const r = await post("/api/check/leg", { m, side: 0 });
    expect(r.status()).toBe(200);
    expect(Object.keys(await r.json()).sort()).toEqual(["market", "outcome", "price", "side", "venue"]);
  }
  const A = [{ m: ids[0], side: 0 }, { m: ids[1], side: 0 }];
  expect((await post("/api/check/combo", { legs: A })).status()).toBe(200);
  expect((await post("/api/check/combo", { legs: [...A].reverse() })).status()).toBe(200);   // same set again: free
  const single = await post("/api/check", { m: ids[2], side: 0 });
  expect(single.status()).toBe(429);
  expect((await single.json()).code).toBe("check_limit");
  const other = await post("/api/check/combo", { legs: [{ m: ids[0], side: 0 }, { m: ids[2], side: 0 }] });
  expect(other.status()).toBe(429);
  expect((await other.json()).code).toBe("check_limit");

  // the page shows the upgrade card for the second combo
  await page.goto(`/check/combo?m=${ids[0]}&side=0`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
  await page.evaluate(([m]) => window.history.pushState(null, "", `/check/combo?m=${m}&side=0`), [ids[2]!]);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId("check-upgrade")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("combo-mult")).toHaveCount(0);
});
