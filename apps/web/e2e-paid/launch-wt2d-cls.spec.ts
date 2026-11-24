// T-wt2d review fixes 2 and 3: a NEW Pro or Premium user whose only topic has nothing open lands on the empty state without moving
// anything (worst of 5 loads < 0.02), and "See all best bets" from it does not shift the page even when the list takes 900 ms.
// The topic is found from the data (a tile that says "none open"), so it holds on any scan. Supabase and Stripe: the in-app mocks.
import { expect, test, type Page } from "./fixtures";
import { expectPlanActive } from "./checkout";

const observe = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __cls: number; __src: string[] };
  w.__cls = 0;
  w.__src = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; startTime: number; sources: { node: Element | null; previousRect: DOMRect; currentRect: DOMRect }[] }[]) if (!e.hadRecentInput) {
    w.__cls += e.value;
    if (e.value > 0.01) w.__src.push(`SNAP @${Math.round(e.startTime)}ms fonts=${document.fonts.status} h1=${JSON.stringify(document.querySelector("h1")?.textContent)} h1h=${Math.round(document.querySelector("h1")?.getBoundingClientRect().height ?? 0)} tour=${!!document.querySelector('[data-testid="tour"]')} cards=${document.querySelectorAll("article[data-row]").length} scrollY=${Math.round(scrollY)} sections=${[...document.querySelectorAll("main > div > *, main > *")].slice(0, 12).map((c) => c.tagName + ":" + Math.round(c.getBoundingClientRect().height)).join(",")}`);
    for (const x of e.sources.slice(0, 4)) w.__src.push(`${e.value.toFixed(4)} @${Math.round(e.startTime)}ms ${x.node?.nodeName}.${String((x.node as HTMLElement | null)?.className ?? "").slice(0, 40)} y ${Math.round(x.previousRect.y)}->${Math.round(x.currentRect.y)} h ${Math.round(x.previousRect.height)}->${Math.round(x.currentRect.height)}`);
  } }).observe({ type: "layout-shift", buffered: true });
});
const sources = (page: Page) => page.evaluate(() => (window as unknown as { __src: string[] }).__src.splice(0).join("\n"));
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
const resetCls = (page: Page) => page.evaluate(() => { (window as unknown as { __cls: number }).__cls = 0; });
const settle = async (page: Page) => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(3_000); };   // the late shifts came at ~2.8 s and ~5 s


/** An empty landing says so plainly and in the first view: the h1 is the message (not "0 bets where the odds lean your way"), and the
 *  line under it ("Widen your topics, or see all best bets") ends above the phone tab bar. The e2e scan is a week old, so its stale-scan
 *  banner (not on a fresh scan) is not counted. */
async function expectHonestEmptyLanding(page: Page, w: number, label: string) {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveText(/^No best bets in .+ today$/);
  await expect(h1).not.toContainText("0 bets");
  const empty = page.getByTestId("empty-state");
  await expect(empty).toContainText("Widen your topics, or see all best bets");
  const line = (await empty.getByText("Widen your topics, or see all best bets").boundingBox())!;
  const seeAll = (await empty.getByRole("button", { name: "See all best bets" }).boundingBox())!;
  const stale = page.getByRole("status").filter({ hasText: "last price scan" });
  const banner = (await stale.count()) ? (await stale.first().boundingBox())!.height + 16 : 0;
  const nav = await page.getByRole("navigation", { name: "Main" }).evaluate((n) => { const r = n.getBoundingClientRect(); return r.top > innerHeight / 2 ? r.top : innerHeight; });
  const bottom = line.y + (await page.evaluate(() => scrollY)) - banner + line.height;
  console.log(`${label}: empty message bottom ${Math.round(bottom)} (fresh scan), tab bar top ${Math.round(nav)}, h1 ${JSON.stringify(await h1.innerText())}`);
  expect(bottom, `${label}: the message is above the tab bar on a fresh scan at ${w}px`).toBeLessThanOrEqual(nav);
  const btnBottom = seeAll.y + (await page.evaluate(() => scrollY)) - banner + seeAll.height;
  console.log(`${label}: "See all best bets" bottom ${Math.round(btnBottom)}`);
  expect(btnBottom, `${label}: the primary button is above the tab bar too`).toBeLessThanOrEqual(nav);
}

for (const tier of ["pro", "premium"] as const) {
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    test(`new ${tier} user, empty topic landing at ${w}: CLS < 0.02 (worst of 5), and See all best bets with the list 900 ms late: CLS < 0.02`, async ({ page }) => {
      test.setTimeout(900_000);
      await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2d-cls-${tier}-${w}-${Date.now()}` });
      await observe(page);
      await page.setViewportSize({ width: w, height: h });
      const email = `wt2d-cls-${tier}-${w}-${Date.now()}@example.com`;
      await page.goto("/login?next=/pricing");
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
      await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 });
      await page.goto("/pricing");
      await page.getByTestId(`checkout-${tier}`).click();
      await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
      await expectPlanActive(page);

      await page.goto("/onboarding");
      await page.waitForLoadState("networkidle");
      const none = await page.waitForFunction(() => {
        for (const b of document.querySelectorAll("fieldset button[aria-describedby]")) {
          if (document.getElementById(b.getAttribute("aria-describedby")!)?.textContent === "none open") return (b.textContent ?? "").replace("none open", "").trim();
        }
        return null;
      }, undefined, { timeout: 60_000 });
      const tile = page.getByRole("button", { name: (await none.jsonValue()) as string, exact: true });
      await tile.click();
      await expect(tile).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await resetCls(page);
      await page.getByRole("button", { name: "Show my best bets" }).click();
      const empty = page.getByTestId("empty-state");
      await expect(empty).toBeVisible({ timeout: 60_000 });
      await settle(page);
      await expectHonestEmptyLanding(page, w, `${tier} ${w} first landing`);
      const runs = [await cls(page)];
      if (runs[0]! > 0.005) console.log(`${tier} ${w} landing shifts:\n${await sources(page)}`);
      for (let i = 0; i < 4; i++) {   // four more cold loads of the same landing
        await page.goto("/");
        await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 60_000 });
        await expectHonestEmptyLanding(page, w, `${tier} ${w} load ${i + 2}`);   // a returning user opening "/"
        await settle(page);
        runs.push(await cls(page));
        if (runs[runs.length - 1]! > 0.005) console.log(`${tier} ${w} load ${i + 2} shifts:\n${await sources(page)}`);
      }
      console.log(`${tier} ${w}: landing CLS of 5 runs ${runs.map((x) => x.toFixed(4)).join(" ")}; worst ${Math.max(...runs).toFixed(4)}`);
      expect(Math.max(...runs), "worst of 5 landings").toBeLessThan(0.02);

      const skipTour = page.getByRole("button", { name: "Skip tour" });   // the first-run tour covers the page and takes taps
      await skipTour.waitFor({ timeout: 30_000 }).catch(() => {});   // it opens a few seconds in (later on a slow runner): skip it now, not mid-measurement
      if (await skipTour.isVisible()) await skipTour.click();
      // "See all best bets" is the primary button here: the list answers 900 ms late (past the 500 ms input window), the page stays put
      await page.goto("/");
      await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 60_000 });
      await settle(page);
      if (await skipTour.isVisible()) await skipTour.click();
      await page.route("**/api/flags*", async (r) => { await new Promise((x) => setTimeout(x, 900)); await r.continue(); });
      // The cards' own late data: /api/backtest answers 6 s after the cards mount (a slow runner got it at ~14 s). "Lower confidence" cards
      // write their tested record under the sample line when it lands; that must not move the page.
      await page.route("**/api/backtest*", async (r) => { await new Promise((x) => setTimeout(x, 6_000)); await r.continue(); });
      // Pro/Premium cards also ask /api/book for live prices ~1.5 s after they appear; a cold server answers ~10 s later
      await page.route("**/api/book*", async (r) => { await new Promise((x) => setTimeout(x, 9_000)); await r.continue(); });
      await resetCls(page);
      await empty.getByRole("button", { name: "See all best bets" }).click();
      await expect(page.locator("article[data-row]").first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(2_000);
      const afterList = await cls(page);   // the list landing alone (the 0.397 case)
      console.log(`${tier} ${w}: See all best bets with the list 900 ms late: CLS ${afterList.toFixed(4)}`);
      expect(afterList).toBeLessThan(0.02);
      await page.waitForTimeout(14_000);   // past the 6 s backtest answer and the 9 s live-price answer
      const after = await cls(page);
      console.log(`${tier} ${w}: ... and with the backtest record 6 s late: CLS ${after.toFixed(4)}\n${await sources(page)}`);
      expect(after, "the backtest record landing in the cards").toBeLessThan(0.02);
    });
  }
}
