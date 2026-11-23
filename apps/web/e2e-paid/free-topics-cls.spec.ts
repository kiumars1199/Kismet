// #71 review: on Free, changing the topic filter must not shift the page. /api/flags is delayed 1.5 s (the answer lands
// well outside the 500 ms input window, so every shift counts); CLS ignores entries with hadRecentInput.
import { expect, test, type Page } from "@playwright/test";

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
const readCls = async (page: Page) => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1_500); return page.evaluate(() => (window as unknown as { __cls: number }).__cls); };

type Flags = { rows: unknown[]; total: number; free_daily?: number; facets: { topics: Record<string, number> } };

/** A topic where today's Free sample has nothing (total > 0, no rows). Found from the data, not hard-coded. */
async function topics(page: Page) {
  const all = (await (await page.request.get("/api/flags")).json()) as Flags;
  let empty: string | null = null;
  for (const t of Object.keys(all.facets.topics).slice(0, 40)) {
    const r = (await (await page.request.get(`/api/flags?t=${encodeURIComponent(t)}`)).json()) as Flags;
    if (r.free_daily === undefined || r.total === 0) continue;
    if (r.rows.length === 0 && !empty) empty = t;
    if (empty) break;
  }
  return { empty };
}

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test.describe(`Free at ${w}px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });

    test("Show today's free bets: CLS < 0.1 when /api/flags is slow", async ({ page }) => {
      test.setTimeout(150_000);
      await signUp(page, `cls-free-a-${w}-${Date.now()}@example.com`);
      const { empty } = await topics(page);
      expect(empty, "a topic with no bets in today's Free sample").not.toBeNull();
      await page.goto(`/bets?t=${encodeURIComponent(empty!)}`);
      const show = page.getByTestId("show-free-sample");
      await expect(show).toBeVisible({ timeout: 60_000 });
      await skipTour(page);
      await page.waitForLoadState("networkidle");
      await page.route("**/api/flags*", async (r) => { await new Promise((x) => setTimeout(x, 1_500)); await r.continue(); });
      await observeCls(page);
      await show.click();
      await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 30_000 });
      const cls = await readCls(page);
      console.log(`CLS show-free-sample at ${w}px: ${cls.toFixed(3)}`);
      expect(cls).toBeLessThan(0.1);
    });

    test("removing a filter pill swaps the sample without shifting the page", async ({ page }) => {
      test.setTimeout(150_000);
      await signUp(page, `cls-free-b-${w}-${Date.now()}@example.com`);
      // a "Return ≥ +N%" filter that leaves the Free sample short: removing its pill grows the list to the full sample
      let roi: number | null = null;
      for (const n of [5, 10, 15, 20, 30, 40, 60, 80, 120, 200]) {
        const r = (await (await page.request.get(`/api/flags?roi=${n}`)).json()) as Flags;
        if (r.free_daily !== undefined && r.rows.length >= 1 && r.rows.length <= 6) { roi = n; break; }
      }
      expect(roi, "a return filter that leaves 1 to 6 of today's Free bets").not.toBeNull();
      await page.goto(`/bets?roi=${roi}`);
      const pill = page.getByRole("link", { name: `Remove filter: Return ≥ +${roi}%` });
      await expect(pill).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 60_000 });
      await skipTour(page);
      await page.waitForLoadState("networkidle");
      await page.route("**/api/flags*", async (r) => { await new Promise((x) => setTimeout(x, 1_500)); await r.continue(); });
      await observeCls(page);
      await pill.click();
      await expect(page).not.toHaveURL(/[?&]roi=/);
      const cls = await readCls(page);
      console.log(`CLS remove pill at ${w}px: ${cls.toFixed(3)}`);
      expect(cls).toBeLessThan(0.1);
    });

    // The reverse direction: a full list on screen, then a filter change (a soft navigation, as the screener does) whose
    // answer is Free's empty sample. The new heading row and the short list must not pull the page around.
    for (const from of ["all", "one"] as const) {
      test(`full → empty (${from === "all" ? "10 bets" : "a few bets"} on screen): CLS < 0.1 when /api/flags is slow`, async ({ page }) => {
        test.setTimeout(300_000);
        await signUp(page, `cls-free-c-${from}-${w}-${Date.now()}@example.com`);
        const { empty } = await topics(page);
        expect(empty, "a topic with no bets in today's Free sample").not.toBeNull();
        let start = "/bets?fav=0";
        if (from === "one") {
          let roi: number | null = null;
          for (const n of [5, 10, 15, 20, 30, 40, 60, 80, 120, 200]) {
            const r = (await (await page.request.get(`/api/flags?roi=${n}`)).json()) as Flags;
            if (r.free_daily !== undefined && r.rows.length >= 1 && r.rows.length <= 3) { roi = n; break; }
          }
          test.skip(roi === null, "no return filter leaves 1 to 3 of today's Free bets");
          start = `/bets?fav=0&roi=${roi}`;
        }
        await page.goto(start);
        await expect(page.getByTestId("bets-list").locator("article").first()).toBeVisible({ timeout: 60_000 });
        await skipTour(page);
        await page.waitForLoadState("networkidle");
        await page.route("**/api/flags*", async (r) => { await new Promise((x) => setTimeout(x, 1_500)); await r.continue(); });
        await observeCls(page);
        await page.evaluate((u) => { window.history.pushState(null, "", u); }, `/bets?fav=1&t=${encodeURIComponent(empty!)}`);
        await expect(page.getByTestId("show-free-sample")).toBeVisible({ timeout: 30_000 });
        const cls = await readCls(page);
          if (cls >= 0.1) console.log((await page.evaluate(() => (window as unknown as { __src: string[] }).__src)).join("\n"));   // what moved, when it fails
        console.log(`CLS full → empty (${from}) at ${w}px: ${cls.toFixed(3)}`);
        expect(cls).toBeLessThan(0.1);
      });
    }
  });
}
