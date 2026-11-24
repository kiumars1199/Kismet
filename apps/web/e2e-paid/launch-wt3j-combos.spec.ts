// T-wt3j (WT3 re-walk): the Premium /combos page does not jump on load (CLS <= 0.02 at 390 and 1440), the list is in the first HTML for
// Premium only, switching the payout filter shifts nothing, and Free and Pro still see the upgrade card with no combos in their HTML.
// Fixture data, paid mock build. Screenshots (deviceScaleFactor 1) go to docs/launch/review/wt3j/ when WT3J_SHOTS=1.
import { expect, test, type Page } from "./fixtures";
import path from "node:path";

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

async function setTier(page: Page, tier: "pro" | "premium") {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier },
  });
  expect(res.status()).toBeLessThan(300);
  expect((await (await page.request.get("/api/me")).json()).tier).toBe(tier);
}

const watchCls = () => {
  const w = window as unknown as { __cls: number; __shifts: string[] };
  w.__cls = 0; w.__shifts = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Element; previousRect: DOMRect; currentRect: DOMRect }[] }[]) {
      if (e.hadRecentInput) continue;
      w.__cls += e.value;
      w.__shifts.push(`${e.value.toFixed(4)} ${(e.sources ?? []).map((s) => `${s.node?.nodeName} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`).join(",")}`);
    }
  }).observe({ type: "layout-shift", buffered: true });
};
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
const shifts = (page: Page) => page.evaluate(() => (window as unknown as { __shifts: string[] }).__shifts);
const shot = async (page: Page, name: string) => { if (process.env.WT3J_SHOTS) await page.screenshot({ path: path.join(__dirname, "../../../docs/launch/review/wt3j", name) }); };

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`Premium /combos at ${w}x${h}: loads without a jump (CLS <= 0.02), the list is in the first HTML, and the payout filter shifts nothing`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signIn(page, `wt3j-prem-${w}-${Date.now()}@example.com`);
    await setTier(page, "premium");
    await page.addInitScript(watchCls);
    const html = await (await page.request.get("/combos")).text();
    expect(html, "the first list arrives in the HTML").toMatch(/data-testid="combos-range"/);
    await page.goto("/combos");
    await expect(page.getByTestId("combos-range")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    const load = await cls(page);
    console.log(`T-wt3j Premium /combos load CLS at ${w}: ${load.toFixed(4)} ${JSON.stringify(await shifts(page))}`);
    await shot(page, `combos-${w}.png`);
    expect(load).toBeLessThan(0.02);
    await expect(page.getByText("Loading combos…")).toHaveCount(0);

    // switching the payout: the list stays until the new one lands, and the page does not jump
    const before = await cls(page);
    for (const p of [3, 5, 10, 2]) {
      await page.getByRole("button", { name: `Pays ${p}x+` }).click();
      await expect(page.getByRole("button", { name: `Pays ${p}x+` })).toHaveAttribute("aria-pressed", "true");
      await page.waitForTimeout(1_200);
    }
    const switched = (await cls(page)) - before;
    console.log(`T-wt3j payout switches CLS at ${w}: ${switched.toFixed(4)} ${JSON.stringify((await shifts(page)).slice(-3))}`);
    expect(switched).toBeLessThan(0.02);
  });
}

for (const tier of ["free", "pro"] as const) {
  test(`${tier}: /combos still shows the upgrade card, with no combos in the HTML`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, `wt3j-${tier}-${Date.now()}@example.com`);
    if (tier === "pro") await setTier(page, "pro");
    await page.addInitScript(watchCls);
    const html = await (await page.request.get("/combos")).text();
    expect(html).not.toMatch(/data-testid="combos-range"/);
    expect(html).not.toMatch(/"market_id"/);
    await page.goto("/combos");
    await expect(page.getByTestId("combos-upgrade")).toBeVisible();
    await expect(page.getByTestId("combos-range")).toHaveCount(0);
    await page.waitForTimeout(1_000);
    expect(await cls(page)).toBeLessThan(0.02);
  });
}
