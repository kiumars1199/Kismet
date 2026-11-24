// T-wt3l: going Back from /check to /bets must not move the page. Back restores the scroll position; the page behind it was a short loading
// skeleton for a moment, the footer sat in view, then the real list arrived and the footer shot down (CLS 0.55 at 390, 3 tries in 4).
// A first load of /bets stays <= 0.02 too.
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
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}
async function comp(page: Page, tier: "pro" | "premium") {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier },
  });
  expect(res.status()).toBeLessThan(300);
}
const installCls = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __cls: number; __src: string[] };
  w.__cls = 0; w.__src = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node: Element | null; previousRect: DOMRect; currentRect: DOMRect }[] }[]) if (!e.hadRecentInput) {
      w.__cls += e.value;
      for (const x of e.sources.slice(0, 3)) w.__src.push(`${e.value.toFixed(3)} ${x.node?.tagName} y ${Math.round(x.previousRect.y)}->${Math.round(x.currentRect.y)} h ${Math.round(x.previousRect.height)}->${Math.round(x.currentRect.height)}`);
    }
  }).observe({ type: "layout-shift", buffered: true });
});
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
const why = (page: Page) => page.evaluate(() => (window as unknown as { __src: string[] }).__src.join("\n"));
const skipTour = async (page: Page) => { const b = page.getByRole("button", { name: "Skip tour" }); await b.waitFor({ timeout: 3_000 }).catch(() => {}); if (await b.isVisible()) await b.click(); };

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`/bets at ${w}px: first load, and Back from /check, 10 times, CLS <= 0.02`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt3l-${w}-${Date.now()}@example.com`);
    await comp(page, "premium");
    await installCls(page);
    await page.goto("/bets", { waitUntil: "load" });
    const list = page.getByTestId("bets-list");
    await expect(list.locator("article").first()).toBeVisible({ timeout: 60_000 });
    await skipTour(page);
    await page.waitForTimeout(2_500);
    const first = await cls(page);
    console.log(`first load /bets at ${w}px: CLS ${first.toFixed(4)}`);
    if (first > 0.02) console.log(await why(page));
    expect(first, "first load").toBeLessThanOrEqual(0.02);
    const worst: number[] = [];
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const link = page.getByTestId("check-link").nth(i % 3);
      await link.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 200));   // somewhere down the list, as after reading a few cards
      await link.click();
      await expect(page).toHaveURL(/\/check\?m=/);
      await page.waitForTimeout(800);
      await page.evaluate(() => { (window as unknown as { __cls: number; __src: string[] }).__cls = 0; (window as unknown as { __src: string[] }).__src = []; });
      await page.goBack();
      await expect(page).toHaveURL(/\/bets/);
      await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2_000);
      const v = await cls(page);
      worst.push(v);
      if (v > 0.02) console.log(`try ${i}: CLS ${v.toFixed(4)}\n${await why(page)}`);
    }
    console.log(`Back to /bets at ${w}px, CLS per try: ${worst.map((x) => x.toFixed(4)).join(" ")}`);
    expect(Math.max(...worst), "worst Back").toBeLessThanOrEqual(0.02);
  });
}

// The reviewer's path: a full load of /check (typed address, new tab, a reload), then the browser's Back, which loads /bets again from the
// server with the scroll position restored (751 px) while the page is still a short skeleton.
for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`/bets at ${w}px: Back after a full load of /check, 10 times, CLS <= 0.02`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt3l-full-${w}-${Date.now()}@example.com`);
    await comp(page, "premium");
    await installCls(page);
    const worst: number[] = [];
    for (let i = 0; i < 10; i++) {
      await page.goto("/bets", { waitUntil: "load" });
      await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 60_000 });
      await skipTour(page);
      await page.evaluate(() => window.scrollTo(0, 751));
      await page.waitForTimeout(500);
      await page.goto("/check", { waitUntil: "load" });
      await page.goBack({ waitUntil: "load" });
      await expect(page).toHaveURL(/\/bets/);
      await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2_000);
      const v = await cls(page);
      worst.push(v);
      if (v > 0.02) console.log(`try ${i}: CLS ${v.toFixed(4)}\n${await why(page)}`);
    }
    console.log(`Back (full load) to /bets at ${w}px, CLS per try: ${worst.map((x) => x.toFixed(4)).join(" ")}`);
    expect(Math.max(...worst), "worst Back").toBeLessThanOrEqual(0.02);
  });
}
