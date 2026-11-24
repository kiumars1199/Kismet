// T-wt3f (#125 review follow-ups), fixture data, paid mock build. Layout-shift budget 0.02 per page view.
//  1. Free, a same-event combo, a slow (1.5 s) 429 "daily check used": the upgrade box lands in the button's own slot, so the same-event note does not move (CLS < 0.02 at 390).
//  2. A scored combo link reloaded while scrolled (Pro, 390): CLS < 0.02 at every scroll position.
//  3. The "combo checker" link in the tray's same-event alert is a whole 44 px target: the button below it does not cover its bottom.
// Screenshots (deviceScaleFactor 1) go to docs/launch/review/wt3f/ when WT3F_SHOTS=1.
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

/** Each test is its own device for the daily check count (the server honors x-e2e-device only under E2E_MOCK). */
const ownDevice = (page: Page) => page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3f-${Date.now()}-${Math.random().toString(36).slice(2)}` });

const watchCls = () => {
  const w = window as unknown as { __cls: number; __shifts: string[] };
  w.__cls = 0; w.__shifts = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Element; previousRect: DOMRect; currentRect: DOMRect }[] }[]) {
      if (e.hadRecentInput) continue;
      w.__cls += e.value;
      w.__shifts.push(`${e.value.toFixed(4)} ${(e.sources ?? []).map((s) => `${s.node?.getAttribute?.("data-testid") ?? s.node?.tagName} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`).join(",")}`);
    }
  }).observe({ type: "layout-shift", buffered: true });
};
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
const shifts = (page: Page) => page.evaluate(() => (window as unknown as { __shifts: string[] }).__shifts);
const shot = async (page: Page, name: string) => { if (process.env.WT3F_SHOTS) await page.screenshot({ path: path.join(__dirname, "../../../docs/launch/review/wt3f", name) }); };

const SET_A = "6417673:1,6674485:0";               // two events: spends the day's one Free check
const SET_B = "6674485:0,6674492:0,7077574:0";     // 6674485 and 6674492 are two markets of one event (Denmark vs. Norway)

for (const w of [390, 1440]) {
  test(`Free, a same-event combo, a slow 429: the upgrade box lands in the button's slot and nothing below it moves (CLS < 0.02 at ${w})`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
    await ownDevice(page);
    await signIn(page, `wt3f-429-${w}-${Date.now()}@example.com`);
    await page.addInitScript(watchCls);
    let slow = false;
    await page.route("**/api/check/combo", async (r) => { if (slow) await new Promise((ok) => setTimeout(ok, 1_500)); await r.continue(); });
    await page.goto(`/check/combo?legs=${encodeURIComponent(SET_A)}`);
    await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
    await page.getByTestId("combo-check-btn").click();   // the day's check
    await expect(page.getByTestId("combo-chance")).toBeVisible({ timeout: 30_000 });
    await page.goto(`/check/combo?legs=${encodeURIComponent(SET_B)}`);
    await expect(page.getByTestId("combo-leg")).toHaveCount(3, { timeout: 30_000 });
    const note = page.getByTestId("combo-same-event");
    await expect(note).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_000);
    const btn = page.getByTestId("combo-check-btn");
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    slow = true;
    const doc = async (id: string) => page.getByTestId(id).evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY));
    const [noteBefore, legsBefore, before] = [await doc("combo-same-event"), await doc("combo-legs"), await cls(page)];
    await shot(page, `before-429-${w}.png`);
    await btn.click();
    await expect(page.getByTestId("check-upgrade")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_000);
    await shot(page, `after-429-${w}.png`);
    const moved = (await cls(page)) - before;
    console.log(`T-wt3f slow 429 at ${w}: CLS ${moved.toFixed(4)} note ${noteBefore}->${await doc("combo-same-event")} ${JSON.stringify((await shifts(page)).slice(-3))}`);
    expect(await doc("combo-legs")).toBe(legsBefore);
    expect(await doc("combo-same-event")).toBe(noteBefore);
    expect(moved).toBeLessThan(0.02);
    await expect(page.getByTestId("combo-check").getByTestId("check-upgrade")).toHaveCount(1);
  });
}

test("a scored combo link reloaded while scrolled holds still at 390 (CLS < 0.02 at 400 to 600 px)", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await ownDevice(page);
  await signIn(page, `wt3f-rl-${Date.now()}@example.com`);
  await setTier(page, "pro");
  await page.addInitScript(watchCls);
  const url = `/check/combo?legs=${encodeURIComponent("7077574:0,6417673:1,6674501:1")}&check=1`;
  const worst: string[] = [];
  let max = 0;
  for (const y of [400, 500, 600]) {
    await page.goto(url);
    await expect(page.getByTestId("combo-chance")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await page.evaluate((to) => scrollTo(0, to), y);
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: "load" });
    await expect(page.getByTestId("combo-chance")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2_500);
    const v = await cls(page);
    max = Math.max(max, v);
    worst.push(`${y}: ${v.toFixed(4)} ${JSON.stringify(await shifts(page))}`);
    if (y === 500) await shot(page, "reload-scrolled-390.png");
  }
  console.log(`T-wt3f scrolled reload CLS at 390\n  ${worst.join("\n  ")}`);
  expect(max).toBeLessThan(0.02);
});

test("Premium: the 'combo checker' link in the same-event alert is a whole 44 px target (the button below does not cover it)", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await ownDevice(page);
  await signIn(page, `wt3f-link-${Date.now()}@example.com`);
  await setTier(page, "premium");
  const meta = (await (await page.request.get("/api/meta")).json()) as { meta: { scanned_at: number } };
  await page.clock.setFixedTime(new Date((meta.meta.scanned_at + 60) * 1000));   // the tray judges "closed" by the browser clock; the fixture scan is days old
  await page.goto("/m/6674485");
  await expect(async () => {   // the first tap can land before the page is hydrated
    if (!(await page.getByRole("button", { name: /In combo/ }).first().isVisible())) await page.getByRole("button", { name: /Add to combo tray/ }).first().click({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /In combo/ }).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await page.goto("/m/6674492");
  await page.getByRole("button", { name: /Add to combo tray/ }).first().click();
  const alert = page.getByRole("alert").filter({ hasText: "already has a bet from this event" });
  const link = alert.getByRole("link", { name: "combo checker" });
  await expect(link).toBeVisible();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = (await link.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await shot(page, "alert-link-390.png");
  // every point down the link's height, 8 px in from its left edge, belongs to the link (not to the button below)
  const hits = await page.evaluate(({ x, y, h }) => {
    const out: string[] = [];
    for (let dy = 1; dy < h; dy += 3) { const e = document.elementFromPoint(x, y + dy); out.push(e?.closest("a")?.textContent === "combo checker" ? "link" : e?.tagName ?? "none"); }
    return out;
  }, { x: box.x + 8, y: box.y, h: box.height });
  expect(hits.filter((v) => v !== "link")).toEqual([]);
});
