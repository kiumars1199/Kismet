// T-wt2g (walk-through 2): signed in as Free, /alerts and /dashboards load without the footer jumping (CLS <= 0.02 at 390 and
// 1440), and the /check limit card is sized to its content (it was a ~1000 px box with ~100 px of text) with no shift either.
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

/** Layout shifts from the first paint (buffered), as the reviewer counts them; ones right after an input are not counted. */
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
const cls = async (page: Page) => { await page.waitForLoadState("load"); await page.waitForTimeout(3_000); return page.evaluate(() => (window as unknown as { __cls: number }).__cls); };
const why = (page: Page) => page.evaluate(() => (window as unknown as { __src: string[] }).__src.join("\n"));
const skipTour = async (page: Page) => { const b = page.getByRole("button", { name: "Skip tour" }); await b.waitFor({ timeout: 3_000 }).catch(() => {}); if (await b.isVisible()) await b.click(); };

/** A comp through the mock database (service role), as the other paid specs do. */
async function comp(page: Page, tier: "pro" | "premium") {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier },
  });
  expect(res.status()).toBeLessThan(300);
  expect((await (await page.request.get("/api/me")).json()).tier).toBe(tier);
}

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test.describe(`Free at ${w}px`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });

    test("/alerts and /dashboards load with CLS <= 0.02", async ({ page }) => {
      test.setTimeout(240_000);
      await signUp(page, `wt2g-cls-${w}-${Date.now()}@example.com`);
      await installCls(page);
      for (const [path, heading] of [["/alerts", "Alerts"], ["/dashboards", "Dashboards"]] as const) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 30_000 });
        await skipTour(page);
        const v = await cls(page);
        console.log(`CLS ${path} at ${w}px: ${v.toFixed(4)}`);
        if (v > 0.02) console.log(await why(page));
        expect(v, `${path} at ${w}`).toBeLessThanOrEqual(0.02);
        if (process.env.WT2G_SHOTS) await page.screenshot({ path: `${process.env.WT2G_SHOTS}/${w}-${path.slice(1)}.png` });   // evidence only
        // the empty state really arrived (not a stuck skeleton)
        await expect(page.getByRole("heading", { name: path === "/alerts" ? "No alert rules yet" : "No dashboards yet" })).toBeVisible();
      }
    });

    for (const tier of ["pro", "premium"] as const) {
      test(`/alerts as ${tier}: CLS <= 0.02 from first paint (the email sentence and the Phone alerts card are hinted by the plan)`, async ({ page }) => {
        test.setTimeout(240_000);
        await signUp(page, `wt2g-${tier}-${w}-${Date.now()}@example.com`);
        await comp(page, tier);
        await installCls(page);
        await page.goto("/alerts");
        await expect(page.getByRole("heading", { level: 1, name: "Alerts" })).toBeVisible({ timeout: 30_000 });
        await skipTour(page);
        await expect(page.getByTestId("push-toggle")).toBeVisible();
        await expect(page.getByText("our servers also check once a day")).toBeVisible();
        const v = await cls(page);
        console.log(`CLS /alerts as ${tier} at ${w}px: ${v.toFixed(4)}`);
        if (v > 0.02) console.log(await why(page));
        expect(v).toBeLessThanOrEqual(0.02);
        if (process.env.WT2G_SHOTS) await page.screenshot({ path: `${process.env.WT2G_SHOTS}/${w}-alerts-${tier}.png` });   // evidence only
      });
    }

    test("/settings: the Time zone and State selects use the same text size (14 px on desktop, 16 px on phones)", async ({ page }) => {
      test.setTimeout(240_000);
      await signUp(page, `wt2g-set-${w}-${Date.now()}@example.com`);
      await page.goto("/settings");
      const tz = page.getByLabel("Time zone");
      await expect(tz).toBeVisible({ timeout: 30_000 });
      const size = (l: typeof tz) => l.evaluate((e) => getComputedStyle(e).fontSize);
      const want = w >= 768 ? "14px" : "16px";
      expect(await size(tz)).toBe(want);
      expect(await size(page.getByTestId("state-select"))).toBe(want);
    });

    test("/check: the Free limit card is as tall as its content, and appearing shifts nothing", async ({ page }) => {
      test.setTimeout(240_000);
      await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2g-${w}-${Date.now()}` });
      await signUp(page, `wt2g-limit-${w}-${Date.now()}@example.com`);
      const ids = ((await (await page.request.get("/api/markets?limit=40")).json()).rows as { market: { id: string } }[]).map((x) => x.market.id);
      const origin = new URL(page.url()).origin;
      const post = (m: string) => page.request.post("/api/check", { data: { m, side: 0 }, headers: { Origin: origin } });
      expect((await post(ids[0]!)).status()).toBe(200);
      expect((await post(ids[1]!)).status()).toBe(429);
      await installCls(page);
      await page.goto(`/check?m=${ids[1]}&side=0`);
      const card = page.getByTestId("check-upgrade");
      await expect(card).toBeVisible({ timeout: 30_000 });
      const v = await cls(page);
      console.log(`CLS /check limit at ${w}px: ${v.toFixed(4)}`);
      if (v > 0.02) console.log(await why(page));
      expect(v).toBeLessThanOrEqual(0.02);
      const box = (await card.boundingBox())!;
      console.log(`limit card ${Math.round(box.width)}x${Math.round(box.height)} at ${w}px`);
      expect(box.height, "sized to its content").toBeLessThan(260);
      if (process.env.WT2G_SHOTS) await page.screenshot({ path: `${process.env.WT2G_SHOTS}/${w}-check-limit.png` });   // evidence only
      await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();
    });
  });
}
