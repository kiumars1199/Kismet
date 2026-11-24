// T-wt2i (Walk-through 2, r3 re-walk): a Free account with 3 saved topics (NFL, Soccer, College basketball) loads /markets?q=texans
// and /?view=flags&fav=1 with CLS <= 0.02 at 390 and 1440; the saved-topics bar label reads "Your topics (3)" on fav=1 with no t=;
// the /check limit page isn't padded with a screenful of empty space; and three tap targets are >= 44 px.
import { expect, test, type Page } from "./fixtures";

async function signUpWithTopics(page: Page, email: string, topics: RegExp[]) {
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
  for (const t of topics) {   // one at a time, each confirmed: a click before the picker is ready, or two in a row, can save fewer topics than were clicked
    const b = page.getByRole("button", { name: t });
    await expect(async () => {
      if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
      await expect(b).toHaveAttribute("aria-pressed", "true", { timeout: 1_500 });
    }).toPass({ timeout: 30_000 });
    await page.waitForTimeout(400);   // let the save land before the next click builds on it
  }
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}
/** The quick-filter chips row (after the filter pills) is one line whatever the saved topics add to it: the server renders it without them. */
const chipRowHeight = (page: Page) => page.locator('[aria-label="Quick filters"]').nth(1).evaluate((e) => e.getBoundingClientRect().height);
const THREE = [/^NFL/, /^Soccer/, /^College basketball/];

const installCls = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __cls: number; __src: string[] };
  w.__cls = 0; w.__src = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node: Element | null; previousRect: DOMRect; currentRect: DOMRect }[] }[]) if (!e.hadRecentInput) {
      w.__cls += e.value;
      for (const x of e.sources.slice(0, 4)) w.__src.push(`${e.value.toFixed(3)} ${x.node?.tagName}.${(x.node as HTMLElement | null)?.className?.toString().slice(0, 40)} y ${Math.round(x.previousRect.y)}->${Math.round(x.currentRect.y)} h ${Math.round(x.previousRect.height)}->${Math.round(x.currentRect.height)}`);
    }
  }).observe({ type: "layout-shift", buffered: true });
});
const settle = async (page: Page, idle = true) => { await page.waitForLoadState(idle ? "networkidle" : "load"); await page.waitForTimeout(2_500); };
const clsOf = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
const why = (page: Page) => page.evaluate(() => (window as unknown as { __src: string[] }).__src.join("\n"));
const skipTour = async (page: Page) => { const b = page.getByRole("button", { name: "Skip tour" }); await b.waitFor({ timeout: 3_000 }).catch(() => {}); if (await b.isVisible()) await b.click(); };

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test.describe(`Free with 3 saved topics at ${w}px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });

    test("/markets?q=texans and /?view=flags&fav=1: CLS <= 0.02; the bar says Your topics (3)", async ({ page }) => {
      test.setTimeout(240_000);
      await signUpWithTopics(page, `wt2i-${w}-${Date.now()}@example.com`, THREE);
      await installCls(page);
      // twice: the first visit after sign-up has the profile in the browser already; a reload must be as still as the first load
      for (let i = 0; i < 2; i++) {
        await page.goto("/markets?q=texans", { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { level: 1, name: "All markets" })).toBeVisible();
        await settle(page);
        const v = await clsOf(page);
        console.log(`CLS /markets?q=texans at ${w}px (visit ${i + 1}): ${v.toFixed(4)}`);
        if (v > 0.02) console.log(await why(page));
        expect(v, `/markets?q=texans at ${w}`).toBeLessThanOrEqual(0.02);
      }
      expect(await chipRowHeight(page), "chips row is one line").toBeLessThanOrEqual(52);
      await page.goto("/?view=flags&fav=1", { waitUntil: "networkidle" });
      await expect(page.getByTestId("bar-sport")).toBeVisible();
      await skipTour(page);
      await settle(page);
      await expect(page.getByTestId("bar-sport").locator("option:checked")).toHaveText("Your topics (3)");
      await expect(page.getByTestId("bar-sport")).not.toHaveValue("");
      const v = await clsOf(page);
      console.log(`CLS /?view=flags&fav=1 at ${w}px: ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await why(page));
      expect(v, `/?view=flags&fav=1 at ${w}`).toBeLessThanOrEqual(0.02);
    });

    test("/markets sort headers are >= 44 px tall without growing the header (desktop table)", async ({ page }) => {
      test.skip(w < 768, "the table is desktop only");
      await signUpWithTopics(page, `wt2i-sort-${w}-${Date.now()}@example.com`, []);
      await page.goto("/markets", { waitUntil: "networkidle" });
      const heads = page.locator("thead button");
      await expect(heads.first()).toBeVisible({ timeout: 30_000 });
      for (const b of await heads.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await page.locator("thead tr").boundingBox())!.height, "header row keeps its height").toBeLessThanOrEqual(58);   // the column chooser (44 px, -my-1) already sets it at 56.5
    });

    test("/markets column menu fits the screen when opened from the top of the page, and after scrolling", async ({ page }) => {
      test.skip(w < 768, "phones list cards, with no column chooser");
      await signUpWithTopics(page, `wt2i-menu-${w}-${Date.now()}@example.com`, []);
      await page.goto("/markets", { waitUntil: "networkidle" });
      await expect(page.locator("tbody tr[data-row]").first()).toBeVisible({ timeout: 30_000 });
      const choose = page.getByTitle("Choose columns");
      const fits = async (where: string) => {
        await choose.click();
        const panel = page.locator("details[open] > div");
        await expect(panel).toBeVisible();
        const b = (await panel.boundingBox())!;
        console.log(`column menu bottom ${Math.round(b.y + b.height)} of ${h} (${where})`);
        expect(b.y + b.height, `menu bottom is inside the screen (${where})`).toBeLessThanOrEqual(h);
        expect(await panel.evaluate((e) => e.scrollHeight > e.clientHeight), "rows scroll inside the menu").toBe(true);
        await choose.click();
        await expect(panel).toBeHidden();
      };
      await fits("top of the page");
      await page.evaluate(() => window.scrollBy(0, 800));
      await fits("after scrolling");
    });

    test("/check limit page: no screenful of empty space under the limit card, and CLS <= 0.02", async ({ page }) => {
      test.setTimeout(240_000);
      await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2i-${w}-${Date.now()}` });
      await signUpWithTopics(page, `wt2i-limit-${w}-${Date.now()}@example.com`, []);
      const ids = ((await (await page.request.get("/api/markets?limit=40")).json()).rows as { market: { id: string } }[]).map((x) => x.market.id);
      const origin = new URL(page.url()).origin;
      const post = (m: string) => page.request.post("/api/check", { data: { m, side: 0 }, headers: { Origin: origin } });
      expect((await post(ids[0]!)).status()).toBe(200);
      expect((await post(ids[1]!)).status()).toBe(429);
      await installCls(page);
      await page.goto(`/check?m=${ids[1]}&side=0`);
      const card = page.getByTestId("check-upgrade");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await skipTour(page);
      await settle(page, false);   // /check keeps a request open, so "networkidle" never comes
      const v = await clsOf(page);
      console.log(`CLS /check limit at ${w}px: ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await why(page));
      expect(v).toBeLessThanOrEqual(0.02);
      const cardBottom = (await card.boundingBox())!.y + (await card.boundingBox())!.height + (await page.evaluate(() => scrollY));
      const footerTop = await page.locator("footer").first().evaluate((f) => f.getBoundingClientRect().top + scrollY);
      console.log(`gap under the limit card at ${w}px: ${Math.round(footerTop - cardBottom)}`);
      expect(footerTop - cardBottom, "empty space between the card and the footer").toBeLessThan(300);   // 261 at 1440x900 is the footer sitting at the bottom of a tall screen; it was ~550 at 390
    });
  });
}

// A narrower desktop: the 3 saved-topic chips don't fit beside the standard ones, which wrapped the row to two lines once the profile landed.
test("/markets?q=texans at 1100px with 3 saved topics: CLS <= 0.02, chips stay on one line", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1100, height: 800 });
  await signUpWithTopics(page, `wt2i-1100-${Date.now()}@example.com`, THREE);
  await installCls(page);
  await page.goto("/markets?q=texans", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "All markets" })).toBeVisible();
  await settle(page);
  const v = await clsOf(page);
  console.log(`CLS /markets?q=texans at 1100px: ${v.toFixed(4)}`);
  if (v > 0.02) console.log(await why(page));
  expect(v).toBeLessThanOrEqual(0.02);
  expect(await chipRowHeight(page), "chips row is one line").toBeLessThanOrEqual(52);
  // the row scrolls sideways here: "+ Save this view" and "Saved views" stay in view at its right end, and a fade says there is more
  for (const name of ["+ Save this view", "Saved views"]) {
    const b = (await page.getByRole("button", { name, exact: true }).first().boundingBox())!;
    expect(b.x >= 0 && b.x + b.width <= 1100, `${name} is inside the screen`).toBe(true);
  }
  await expect(page.getByTestId("chips-fade")).toBeVisible();
});

test("/markets?q=texans at 1280px with 3 saved topics: CLS <= 0.02", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await signUpWithTopics(page, `wt2i-1280-${Date.now()}@example.com`, THREE);
  await installCls(page);
  await page.goto("/markets?q=texans", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "All markets" })).toBeVisible();
  await settle(page);
  const v = await clsOf(page);
  console.log(`CLS /markets?q=texans at 1280px: ${v.toFixed(4)}`);
  if (v > 0.02) console.log(await why(page));
  expect(v).toBeLessThanOrEqual(0.02);
});

// Short desktop screens: the room under the button is ~64 px at 1280x720, so the menu opens upward there; it always fits.
for (const { w, h } of [{ w: 1280, h: 720 }, { w: 1100, h: 800 }]) {
  test(`/markets column menu fits at ${w}x${h}: opened at the top of the page and after scrolling`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    await signUpWithTopics(page, `wt2i-menu-${w}-${Date.now()}@example.com`, []);
    await page.goto("/markets", { waitUntil: "networkidle" });
    await expect(page.locator("tbody tr[data-row]").first()).toBeVisible({ timeout: 30_000 });
    const choose = page.getByTitle("Choose columns");
    const fits = async (where: string) => {
      await choose.click();
      const panel = page.locator("details[open] > div");
      await expect(panel).toBeVisible();
      const b = (await panel.boundingBox())!;
      console.log(`column menu ${Math.round(b.y)}-${Math.round(b.y + b.height)} of ${h} at ${w} (${where})`);
      expect(b.y, `menu top is inside the screen (${where})`).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, `menu bottom is inside the screen (${where})`).toBeLessThanOrEqual(h);
      expect(b.height, "the menu is usable (not squeezed)").toBeGreaterThanOrEqual(176);
      await choose.click();
      await expect(panel).toBeHidden();
    };
    await fits("top of the page");
    await page.evaluate(() => window.scrollBy(0, 800));
    await fits("after scrolling");
  });
}

// The /check limit card from the server's own read of the day's counter (no hint cookie, nothing consumed by looking).
async function signIn(page: Page, email: string) {
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
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets" || u.pathname === "/onboarding", { timeout: 60_000 });
}
const marketIds = async (page: Page) => ((await (await page.request.get("/api/markets?limit=40")).json()).rows as { market: { id: string } }[]).map((x) => x.market.id);
const checkOnce = (page: Page, m: string) => page.request.post("/api/check", { data: { m, side: 0 }, headers: { Origin: new URL(page.url()).origin } });

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test.describe(`/check limit state at ${w}px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });

    test("a second browser (no cookies from the first) opens straight on the limit card: CLS <= 0.02", async ({ page, browser }) => {
      test.setTimeout(300_000);
      const device = `wt2i-2nd-${w}-${Date.now()}`;
      await page.context().setExtraHTTPHeaders({ "x-e2e-device": device });
      const email = `wt2i-2nd-${w}-${Date.now()}@example.com`;
      await signUpWithTopics(page, email, []);
      const ids = await marketIds(page);
      expect((await checkOnce(page, ids[0]!)).status()).toBe(200);
      const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, baseURL: new URL(page.url()).origin, extraHTTPHeaders: { "x-e2e-device": device + "-b" } });
      const p2 = await ctx2.newPage();
      await installCls(p2);
      await signIn(p2, email);
      await skipTour(p2);
      await installCls(p2);
      await p2.goto(`/check?m=${ids[1]}&side=0`);
      await expect(p2.getByTestId("check-upgrade")).toBeVisible({ timeout: 30_000 });
      await settle(p2, false);
      const v = await clsOf(p2);
      console.log(`CLS /check limit, second browser at ${w}px: ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await why(p2));
      expect(v).toBeLessThanOrEqual(0.02);
      await ctx2.close();
    });

    test("signed out, one check used; then a new Free signup in the same browser: no 'out of checks' flash, CLS <= 0.02", async ({ page }) => {
      test.setTimeout(300_000);
      await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2i-so-${w}-${Date.now()}` });
      await signUpWithTopics(page, `wt2i-ids-${w}-${Date.now()}@example.com`, []);   // only to read two market ids (the list needs sign-in)
      const ids = await marketIds(page);
      await page.context().clearCookies();   // signed out, same browser and device
      expect((await checkOnce(page, ids[0]!)).status()).toBe(200);
      await signUpWithTopics(page, `wt2i-new-${w}-${Date.now()}@example.com`, []);
      await installCls(page);
      await page.goto(`/check?m=${ids[1]}&side=0`);
      await expect(page.getByRole("region", { name: "Check result" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("check-upgrade")).toHaveCount(0);
      await settle(page, false);
      const v = await clsOf(page);
      console.log(`CLS /check, new signup after a signed-out check at ${w}px: ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await why(page));
      expect(v).toBeLessThanOrEqual(0.02);
    });

    test("normal path: a Free user with their check unused gets the result, the same market stays free, CLS <= 0.02", async ({ page }) => {
      test.setTimeout(300_000);
      await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2i-ok-${w}-${Date.now()}` });
      await signUpWithTopics(page, `wt2i-ok-${w}-${Date.now()}@example.com`, []);
      const ids = await marketIds(page);
      await installCls(page);
      await page.goto(`/check?m=${ids[0]}&side=0`);
      await expect(page.getByRole("region", { name: "Check result" })).toBeVisible({ timeout: 30_000 });
      await settle(page, false);
      const v = await clsOf(page);
      console.log(`CLS /check, unused check at ${w}px: ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await why(page));
      expect(v).toBeLessThanOrEqual(0.02);
      // the check is now used: re-opening the SAME market is free (result, not the limit card); another market is the limit card
      await page.goto(`/check?m=${ids[0]}&side=0`);
      await expect(page.getByRole("region", { name: "Check result" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("check-upgrade")).toHaveCount(0);
      await page.goto(`/check?m=${ids[1]}&side=0`);
      await expect(page.getByTestId("check-upgrade")).toBeVisible({ timeout: 30_000 });
    });
  });
}

test("the check-your-email step's 'Use a different email' is a 44 px target", async ({ page }) => {
  await page.goto("/login");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Email", { exact: true }).fill(`wt2i-tap-${Date.now()}@example.com`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const b = page.getByRole("button", { name: "Use a different email" });
  await expect(b).toBeVisible({ timeout: 30_000 });
  expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
