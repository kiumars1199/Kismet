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

// A Premium page of 50 bets (the default page size) is ~26,000 px at 390 (~33,000 in production): well past the 12,000 px floor of the loading
// skeleton's reserve. The skeleton reserves the height the user left (a cookie set through /api/bets/height), so Back restores the scroll and the
// footer does not shoot down.
const TALL = "/bets?ps=50&wp=0&us=0&g=0&vd=worth%20it,thin,not%20worth%20it,no%20sellers,no%20book";
for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  for (const clearCookie of [false, true]) {
    test(`a 50-bet /bets page at ${w}px: scroll deep, full load of /check, Back${clearCookie ? " (probe: remembered height cleared, i.e. the 12,000 px floor only)" : ""}: scroll restored, CLS <= 0.02`, async ({ page }) => {
      test.skip(clearCookie && !process.env.WT3L_PROBE, "evidence only: shows what the fixed 12,000 px reserve did");
      test.setTimeout(300_000);
      await page.setViewportSize({ width: w, height: h });
      await signUp(page, `wt3l-tall-${w}-${Date.now()}@example.com`);
      await comp(page, "premium");
      await installCls(page);
      const results: string[] = [];
      for (let i = 0; i < 3; i++) {
        await page.goto(TALL, { waitUntil: "load" });
        await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 60_000 });
        await skipTour(page);
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(total, "the page is tall (at 390: well past the skeleton's 12,000 px floor)").toBeGreaterThan(w === 390 ? 20_000 : 5_000);   // at 1440 the cards sit in a grid: 50 bets are ~8,800 px, under the floor
        const target = Math.round((total - h) * 0.8);
        await page.evaluate((y) => window.scrollTo(0, y), target);
        await page.waitForTimeout(900);   // the throttled save
        const before = await page.evaluate(() => window.scrollY);
        await page.goto("/check", { waitUntil: "load" });
        if (clearCookie) await page.context().clearCookies({ name: "bets_h" });
        await page.goBack({ waitUntil: "load" });
        await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2_000);
        const v = await cls(page);
        const after = await page.evaluate(() => window.scrollY);
        results.push(`CLS ${v.toFixed(4)} scroll ${before} -> ${after}`);
        if (v > 0.02) console.log(`try ${i}: CLS ${v.toFixed(4)}\n${await why(page)}`);
        expect(v, `try ${i} CLS`).toBeLessThanOrEqual(0.02);
        expect(Math.abs(after - before), `try ${i}: the scroll position is restored`).toBeLessThanOrEqual(60);
      }
      console.log(`50-bet Back at ${w}px${clearCookie ? " (remembered height cleared)" : ""}: ${results.join(" | ")}`);
    });
  }
}

// The remembered height must not leave blank space when the next list is shorter: the reserve exists only while the skeleton shows.
test("after a tall page, a short /bets list has no blank space below it (the reserve is gone with the skeleton)", async ({ page }) => {
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `wt3l-short-${Date.now()}@example.com`);
  await comp(page, "premium");
  await page.goto(TALL, { waitUntil: "load" });
  await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.scrollTo(0, 15_000));
  await page.waitForTimeout(900);
  await page.goto("/bets?t=sports.nfl", { waitUntil: "load" });   // a short list
  await expect(page.locator("footer").first()).toBeVisible();
  await page.waitForTimeout(2_000);
  const gap = await page.evaluate(() => { const f = document.querySelector("footer")!.getBoundingClientRect(); return Math.round(document.documentElement.scrollHeight - (f.bottom + scrollY)); });
  expect(gap, "nothing is reserved below the footer").toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollHeight), "the page is as tall as its content").toBeLessThan(12_000);
});
