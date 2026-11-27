// T-wt3l: going Back to /bets must not move the page, whatever the list was and wherever the user was. Back restores the scroll position; with a
// loading skeleton in front of the list the page was a different height for a moment, the footer sat in view, then the list arrived and the footer
// shot down (CLS 0.55 at 390). Now /bets keeps final's skeleton and puts the scroll back itself (BetsScrollRestore: saved per history entry in
// sessionStorage; the browser restores nothing on /bets). Nothing is remembered on the server (the bets_h cookie of an earlier attempt is still
// cleared before every Back), and the paths cover a stale or mismatched page (history through a shorter list, a filter push then reload).
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

/** Leave /bets (full load of /check), forget anything a server might have remembered about the page, press Back. */
async function leaveAndBack(page: Page) {
  await page.goto("/check", { waitUntil: "load" });
  await page.context().clearCookies({ name: "bets_h" });
  await page.goBack({ waitUntil: "load" });
}
const firstCard = (page: Page) => expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 60_000 });
const maxScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
const TALL = "/bets?ps=50&wp=0&us=0&g=0&vd=worth%20it,thin,not%20worth%20it,no%20sellers,no%20book";
const SHORT = "/bets?t=sports.nfl";
const SIZES = [{ w: 390, h: 844 }, { w: 1440, h: 900 }];

for (const { w, h } of SIZES) {
  test(`/bets at ${w}px: first load, and Back from /check by the in-app Check link, 10 times, CLS <= 0.02`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt3l-${w}-${Date.now()}@example.com`);
    await comp(page, "premium");
    await installCls(page);
    await page.goto("/bets", { waitUntil: "load" });
    await firstCard(page);
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
      await page.evaluate(() => window.scrollBy(0, 200));
      await link.click();
      await expect(page).toHaveURL(/\/check\?m=/);
      await page.waitForTimeout(800);
      await page.evaluate(() => { (window as unknown as { __cls: number; __src: string[] }).__cls = 0; (window as unknown as { __src: string[] }).__src = []; });
      await page.goBack();
      await expect(page).toHaveURL(/\/bets/);
      await firstCard(page);
      await page.waitForTimeout(2_000);
      const v = await cls(page);
      worst.push(v);
      if (v > 0.02) console.log(`try ${i}: CLS ${v.toFixed(4)}\n${await why(page)}`);
    }
    console.log(`soft Back to /bets at ${w}px, CLS per try: ${worst.map((x) => x.toFixed(4)).join(" ")}`);
    expect(Math.max(...worst), "worst Back").toBeLessThanOrEqual(0.02);
  });
}

// Full-load Back (typed address, reload, new tab) at the middle and near the bottom of the default page (Premium and Free) and the 50-bet page
// (Premium; ~26,000 px at 390). CLS <= 0.02 and the scroll lands within 2 px.
for (const { w, h } of SIZES) {
  for (const [label, tier, url] of [["default page, Premium", "premium", "/bets"], ["default page, Free", "free", "/bets"], ["50-bet page, Premium", "premium", TALL]] as const) {
    for (const [where, at] of [["mid-list", 0.5], ["near the bottom", -1]] as const) {
      test(`Back after a full load of /check, ${label}, ${where}, at ${w}px: CLS <= 0.02, scroll within 2 px`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.setViewportSize({ width: w, height: h });
        await signUp(page, `wt3l-fl-${w}-${tier}-${Date.now()}@example.com`);
        if (tier === "premium") await comp(page, "premium");
        await installCls(page);
        const results: string[] = [];
        for (let i = 0; i < 3; i++) {
          await page.goto(url, { waitUntil: "load" });
          await firstCard(page);
          await skipTour(page);
          await page.waitForTimeout(1_500);
          const max = await maxScroll(page);
          const target = at < 0 ? Math.max(0, max - 120) : Math.round(max * at);
          await page.evaluate((y) => window.scrollTo(0, y), target);
          await page.waitForTimeout(500);
          const before = await page.evaluate(() => window.scrollY);
          await leaveAndBack(page);
          await firstCard(page);
          await page.waitForTimeout(2_000);
          const v = await cls(page);
          const after = await page.evaluate(() => window.scrollY);
          results.push(`CLS ${v.toFixed(4)} scroll ${before} -> ${after}`);
          if (v > 0.02) console.log(`try ${i}: CLS ${v.toFixed(4)}\n${await why(page)}`);
          expect(v, `try ${i} CLS`).toBeLessThanOrEqual(0.02);
          expect(Math.abs(after - before), `try ${i}: the scroll position is restored within 2 px`).toBeLessThanOrEqual(2);
        }
        console.log(`Back (full load), ${label}, ${where}, ${w}px: ${results.join(" | ")}`);
      });
    }
  }
}

// The paths where a remembered height would be wrong. With nothing remembered, none of them may move the page.
for (const { w, h } of SIZES) {
  test(`history through a shorter list at ${w}px: 50-bet page (deep) -> short list -> /check -> Back -> Back: CLS <= 0.02, scroll within 2 px`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt3l-hist-${w}-${Date.now()}@example.com`);
    await comp(page, "premium");
    await installCls(page);
    await page.goto(TALL, { waitUntil: "load" });
    await firstCard(page);
    await skipTour(page);
    await page.waitForTimeout(1_500);
    const deep = Math.round((await maxScroll(page)) * 0.8);
    await page.evaluate((y) => window.scrollTo(0, y), deep);
    await page.waitForTimeout(500);
    await page.goto(SHORT, { waitUntil: "load" });
    await expect(page.locator("footer").first()).toBeVisible();
    await page.waitForTimeout(1_000);
    const shortY = Math.max(0, (await maxScroll(page)) - 80);
    await page.evaluate((y) => window.scrollTo(0, y), shortY);
    await page.waitForTimeout(500);
    const shortBefore = await page.evaluate(() => window.scrollY);
    await page.goto("/check", { waitUntil: "load" });
    await page.context().clearCookies({ name: "bets_h" });
    await page.goBack({ waitUntil: "load" });   // the short list
    await page.waitForTimeout(2_000);
    const v1 = await cls(page);
    const shortAfter = await page.evaluate(() => window.scrollY);
    await page.goBack({ waitUntil: "load" });   // the 50-bet page, from a history entry whose height nobody remembers any more
    await firstCard(page);
    await page.waitForTimeout(2_000);
    const v2 = await cls(page);
    const deepAfter = await page.evaluate(() => window.scrollY);
    console.log(`history at ${w}px: short list CLS ${v1.toFixed(4)} scroll ${shortBefore} -> ${shortAfter}; 50-bet page CLS ${v2.toFixed(4)} scroll ${deep} -> ${deepAfter}`);
    if (v1 > 0.02 || v2 > 0.02) console.log(await why(page));
    expect(v1, "Back to the short list").toBeLessThanOrEqual(0.02);
    expect(Math.abs(shortAfter - shortBefore), "short list scroll within 2 px").toBeLessThanOrEqual(2);
    expect(v2, "second Back to the 50-bet page").toBeLessThanOrEqual(0.02);
    expect(Math.abs(deepAfter - deep), "50-bet page scroll within 2 px").toBeLessThanOrEqual(2);
  });

  test(`a filter push, then a reload, then Back from /check at ${w}px: CLS <= 0.02, scroll within 2 px`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt3l-push-${w}-${Date.now()}@example.com`);
    await comp(page, "premium");
    await installCls(page);
    await page.goto("/bets", { waitUntil: "load" });
    await firstCard(page);
    await skipTour(page);
    await page.waitForTimeout(1_500);
    await page.evaluate((u) => window.history.pushState(null, "", u), TALL);   // a filter push (the URL changes, nothing reloads)
    await page.reload({ waitUntil: "load" });
    await firstCard(page);
    await page.waitForTimeout(1_500);
    const y = Math.max(0, (await maxScroll(page)) - 300);
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => window.scrollY);
    await leaveAndBack(page);
    await firstCard(page);
    await page.waitForTimeout(2_000);
    const v = await cls(page);
    const after = await page.evaluate(() => window.scrollY);
    console.log(`push + reload + Back at ${w}px: CLS ${v.toFixed(4)} scroll ${before} -> ${after}`);
    if (v > 0.02) console.log(await why(page));
    expect(v).toBeLessThanOrEqual(0.02);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
  });
}

test("opening /bets again (same address, same history entry) starts at the top, not at the saved place", async ({ page }) => {
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `wt3l-again-${Date.now()}@example.com`);
  await comp(page, "premium");
  await page.goto("/bets", { waitUntil: "load" });
  await firstCard(page);
  await skipTour(page);
  await page.evaluate(() => window.scrollTo(0, 2_000));
  await page.waitForTimeout(500);
  await page.goto("/bets", { waitUntil: "load" });
  await firstCard(page);
  await page.waitForTimeout(1_500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("after a tall page, a short /bets list has no blank space below it", async ({ page }) => {
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page, `wt3l-short-${Date.now()}@example.com`);
  await comp(page, "premium");
  await page.goto(TALL, { waitUntil: "load" });
  await firstCard(page);
  await page.evaluate(() => window.scrollTo(0, 15_000));
  await page.waitForTimeout(900);
  await page.goto(SHORT, { waitUntil: "load" });
  await expect(page.locator("footer").first()).toBeVisible();
  await page.waitForTimeout(2_000);
  const gap = await page.evaluate(() => { const f = document.querySelector("footer")!.getBoundingClientRect(); return Math.round(document.documentElement.scrollHeight - (f.bottom + scrollY)); });
  expect(gap, "nothing is reserved below the footer").toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollHeight), "the page is as tall as its content").toBeLessThan(12_000);
});

// Tapping the Best bets tab from a short page whose footer is on screen, with /bets taking longer than Chrome's 500 ms input window: nothing may
// move once the window is over (CLS counts then). final's loading skeleton (app/bets/loading.tsx) shows on the tap; a 1 s hold on /bets stands
// in for slow 4G or a busy server.
const holdBets = (page: Page, ms: number) => page.route(/\/bets(\?|$)/, async (route) => { await new Promise((r) => setTimeout(r, ms)); await route.continue(); });
const bestBetsTab = (page: Page, w: number) => (w < 768 ? page.locator('nav[aria-label="Main"] a[href="/bets"]').last() : page.locator('nav[aria-label="Main"] a[href="/bets"]').first());

for (const { w, h } of SIZES) {
  for (const from of ["/check", "/watchlist"] as const) {
    test(`tap Best bets from ${from} at ${w}px with /bets held 1 s: counted CLS <= 0.02, the tap shows feedback at once`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: w, height: h });
      await signUp(page, `wt3l-nav-${w}-${from.slice(1)}-${Date.now()}@example.com`);
      await comp(page, "premium");
      await installCls(page);
      await page.goto(from, { waitUntil: "load" });
      await skipTour(page);
      await page.waitForTimeout(1_500);
      const footerTop = await page.evaluate(() => document.querySelector("footer")!.getBoundingClientRect().top);
      expect(footerTop, "the footer is on screen before the tap (a short page)").toBeLessThan(h);
      await holdBets(page, 1_000);
      await page.evaluate(() => { (window as unknown as { __cls: number; __src: string[] }).__cls = 0; (window as unknown as { __src: string[] }).__src = []; });
      await page.waitForTimeout(700);   // out of any input window from earlier clicks
      await bestBetsTab(page, w).click();
      await expect(page.locator("[data-skeleton]").first(), "the loading skeleton on the tap").toBeVisible({ timeout: 500 });
      await expect(page).toHaveURL(/\/bets/, { timeout: 30_000 });
      await firstCard(page);
      await page.waitForTimeout(2_000);
      const v = await cls(page);
      console.log(`tap Best bets from ${from} at ${w}px (held 1 s): counted CLS ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await why(page));
      expect(v).toBeLessThanOrEqual(0.02);
      await expect(page.locator("[data-skeleton]"), "the skeleton is gone once the list is in").toHaveCount(0);
    });
  }

  test(`tapping another tab while /bets is pending lands on that tab at ${w}px`, async ({ page }) => {
    test.setTimeout(200_000);
    await page.setViewportSize({ width: w, height: h });
    await signUp(page, `wt3l-nav2-${w}-${Date.now()}@example.com`);
    await comp(page, "premium");
    await page.goto("/watchlist", { waitUntil: "load" });
    await skipTour(page);
    await holdBets(page, 4_000);
    await bestBetsTab(page, w).click();
    await expect(page.locator("[data-skeleton]").first()).toBeVisible({ timeout: 1_000 });
    const markets = (w < 768 ? page.locator('nav[aria-label="Main"] a[href="/markets"]').last() : page.locator('nav[aria-label="Main"] a[href="/markets"]').first());
    await markets.click();
    await expect(page).toHaveURL(/\/markets/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "All markets" })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(4_500);   // past the held /bets response: it must not take over
    await expect(page).toHaveURL(/\/markets/);
    await expect(page.getByRole("heading", { level: 1, name: "All markets" })).toBeVisible();
  });
}
