// #71 review: on Free, changing the topic filter must not shift the page. /api/flags is delayed 1.5 s (the answer lands
// well outside the 500 ms input window, so every shift counts); CLS ignores entries with hadRecentInput.
// Independent of the day's random Free sample: the answers for the filtered URLs are shaped from the real unfiltered one
// (no rows, or a few rows), so the same transitions happen on any data.
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

/** A new account's first screen carries a tour that covers the page and takes taps. */
const skipTour = async (page: Page) => { const b = page.getByRole("button", { name: "Skip tour" }); await b.waitFor({ timeout: 10_000 }).catch(() => {}); if (await b.isVisible()) await b.click(); };

const observeCls = (page: Page) => page.evaluate(() => {
  (window as unknown as { __cls: number }).__cls = 0;
  (window as unknown as { __src: string[] }).__src = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node: Element | null; previousRect: DOMRect; currentRect: DOMRect }[] }[]) if (!e.hadRecentInput) {
    (window as unknown as { __cls: number }).__cls += e.value;
    for (const x of e.sources.slice(0, 6)) (window as unknown as { __src: string[] }).__src.push(`${e.value.toFixed(3)} ${x.node?.tagName}.${(x.node as HTMLElement | null)?.getAttribute?.("data-testid") ?? ""}${(x.node as HTMLElement | null)?.getAttribute?.("aria-label") ?? ""} y ${Math.round(x.previousRect.y)}->${Math.round(x.currentRect.y)} h ${Math.round(x.previousRect.height)}->${Math.round(x.currentRect.height)}`);
  } })
    .observe({ type: "layout-shift", buffered: false });
});
const resetCls = (page: Page) => page.evaluate(() => { (window as unknown as { __cls: number }).__cls = 0; });
const sources = (page: Page) => page.evaluate(() => (window as unknown as { __src: string[] }).__src.splice(0).join("\n"));
const readCls = async (page: Page) => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1_500); return page.evaluate(() => (window as unknown as { __cls: number }).__cls); };

type Flags = { rows: unknown[]; groups?: unknown[]; total: number; free_daily?: number };

/** Answer /api/flags 1.5 s late. `shape` rewrites the real answer for URLs the test wants short or empty. */
async function slowFlags(page: Page, shape: (j: Flags, url: URL) => Flags) {
  await page.route("**/api/flags*", async (r) => {
    await new Promise((x) => setTimeout(x, 1_500));
    const res = await r.fetch();
    await r.fulfill({ response: res, json: shape((await res.json()) as Flags, new URL(r.request().url())) });
  });
}
/** Free's empty sample: bets match the filters (total > 0) but none is in today's sample. */
const empty = (j: Flags): Flags => ({ ...j, rows: [], groups: [], total: Math.max(j.total, 5), free_daily: j.free_daily ?? 10 });
/** A short sample: the first few rows. */
const few = (j: Flags): Flags => ({ ...j, rows: j.rows.slice(0, 3), groups: undefined, total: Math.max(j.total, 5), free_daily: j.free_daily ?? 10 });
const EMPTY_URL = "/bets?fav=1&t=sports.nfl";   // any topic: the answer for t= is shaped empty
const push = (page: Page, u: string) => page.evaluate((x) => { window.history.pushState(null, "", x); }, u);
const loadFull = async (page: Page, url = "/bets?fav=0") => {
  await page.goto(url);
  await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 60_000 });
  await skipTour(page);
  await page.evaluate(() => window.scrollTo(0, 0));   // the filters sit at the top: that is where these changes are made from
  await page.waitForLoadState("networkidle");
};

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test.describe(`Free at ${w}px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });

    test("full → empty by a filter change, then Show today's free bets: CLS < 0.1 each way", async ({ page }) => {
      test.setTimeout(300_000);
      await signUp(page, `cls-free-a-${w}-${Date.now()}@example.com`);
      await loadFull(page);
      await slowFlags(page, (j, u) => (u.searchParams.has("t") ? empty(j) : j));
      await observeCls(page);
      await push(page, EMPTY_URL);   // full → empty
      const show = page.getByTestId("show-free-sample");
      await expect(show).toBeVisible({ timeout: 30_000 });
      const forward = await readCls(page);
      if (forward >= 0.1) console.log(await sources(page));
      console.log(`CLS full → empty at ${w}px: ${forward.toFixed(3)}`);
      // T-wt2d: the locked card that says where the bet is sits in the first view, right under the filters where the skeleton cards were (it was ~1.5 screens down)
      const lockedBox = (await page.getByTestId("locked-bets").boundingBox())!;
      const h1Box = (await page.locator("h1").first().boundingBox())!;
      console.log(`locked card at y=${Math.round(lockedBox.y + (await page.evaluate(() => scrollY)))} (h1 bottom ${Math.round(h1Box.y + h1Box.height)}) at ${w}px`);
      // The card starts inside the first screen (390x844 and 1440x900): right under the filters, where the skeleton cards were (it was
      // ~1.5 screens down). The e2e data is a week old, so a stale-scan banner (about 80 px) sits above it here; production's fresh scan
      // doesn't have it, so it is not counted. Directly under the h1 at 390 measured CLS 0.14 (the card is ~250 px tall there and
      // everything under it moves), over the 0.1 budget, so it stays where the skeleton cards were.
      const stale = page.getByRole("status").filter({ hasText: "last price scan" });
      const banner = (await stale.count()) ? (await stale.first().boundingBox())!.height + 16 : 0;
      const top = lockedBox.y + (await page.evaluate(() => scrollY)) - banner;
      console.log(`locked card top ${Math.round(top)} (of ${h}) without the stale banner`);
      expect(top).toBeLessThan(h);
      expect(lockedBox.y).toBeGreaterThanOrEqual(h1Box.y + h1Box.height - 1);
      // The card's MESSAGE (not just its top edge) is in the first screen, above the phone tab bar. Measured on a fresh scan: the stale banner
      // (e2e data is a week old) is not counted. The tab bar only exists on phones.
      const msg = (await page.getByTestId("locked-bets").locator("p").first().boundingBox())!;
      const nav = await page.getByRole("navigation", { name: "Main" }).evaluate((n) => { const r = n.getBoundingClientRect(); return r.top > innerHeight / 2 ? r.top : innerHeight; });
      const msgBottom = msg.y + (await page.evaluate(() => scrollY)) - banner + msg.height;
      console.log(`locked card message bottom ${Math.round(msgBottom)} (fresh scan), tab bar top ${Math.round(nav)} at ${w}px`);
      expect(msgBottom, "the whole message is above the tab bar on a fresh scan").toBeLessThanOrEqual(nav);
      await skipTour(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await resetCls(page);
      await show.click();   // empty → full
      await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 30_000 });
      const back = await readCls(page);
      if (back >= 0.1) console.log(await sources(page));
      console.log(`CLS Show today's free bets at ${w}px: ${back.toFixed(3)}`);
      expect(forward).toBeLessThan(0.1);
      expect(back).toBeLessThan(0.1);
    });

    test("a few bets → empty, and removing a filter pill grows the list back: CLS < 0.1 each way", async ({ page }) => {
      test.setTimeout(300_000);
      await signUp(page, `cls-free-b-${w}-${Date.now()}@example.com`);
      await loadFull(page);
      await slowFlags(page, (j, u) => (u.searchParams.has("t") ? empty(j) : u.searchParams.has("val") ? few(j) : j));
      await push(page, "/bets?fav=0&val=1");   // a real pill ("Tested on past data"), answered with a few rows
      const pill = page.getByRole("link", { name: "Remove filter: Tested on past data" });
      await expect(pill).toBeVisible({ timeout: 30_000 });
      await expect(async () => { expect(await page.getByTestId("bets-list").locator("article").count()).toBeLessThanOrEqual(3); }).toPass({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await observeCls(page);
      await push(page, EMPTY_URL);   // a few → empty
      await expect(page.getByTestId("show-free-sample")).toBeVisible({ timeout: 30_000 });
      const toEmpty = await readCls(page);
      if (toEmpty >= 0.1) console.log(await sources(page));
      console.log(`CLS a few → empty at ${w}px: ${toEmpty.toFixed(3)}`);
      await push(page, "/bets?fav=0&val=1");
      await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await resetCls(page);
      await pill.click();   // a few → full, by removing the pill
      await expect(page).not.toHaveURL(/[?&]val=/);
      await expect(async () => { expect(await page.getByTestId("bets-list").locator("article").count()).toBeGreaterThan(3); }).toPass({ timeout: 30_000 });
      const grow = await readCls(page);
      if (grow >= 0.1) console.log(await sources(page));
      console.log(`CLS remove pill at ${w}px: ${grow.toFixed(3)}`);
      expect(toEmpty).toBeLessThan(0.1);
      expect(grow).toBeLessThan(0.1);
    });
  });
}
