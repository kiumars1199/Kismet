// T-wt3c: the combo tray and the combo checker agree for the same legs (payout and chance), the tray's same-event refusal points to the
// checker, and on a phone the checker's "Check this combo" can be tapped above the open tray. Premium, fixture data.
import { expect, test, type Page } from "./fixtures";

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


async function makePremium(page: Page) {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" },
  });
  expect(res.status()).toBeLessThan(300);
  expect((await (await page.request.get("/api/me")).json()).tier).toBe("premium");
}
/** The paid fixtures are a fixed scan (DATA_CLOCK=scan): the server treats "now" as the scan time. The tray checks closing times against the
 *  browser's clock, so the page is given the scan's time too, or every fixture market would count as closed. */
async function pageClockAtScan(page: Page) {
  const meta = (await (await page.request.get("/api/meta")).json()) as { meta: { scanned_at: number } };
  await page.clock.setFixedTime(new Date((meta.meta.scanned_at + 60) * 1000));
}
const watchCls = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};
type Row = { market: { id: string; event_id: string; us?: unknown }; side: { side_index: number } };
const addToTray = async (page: Page, id: string) => {
  await page.goto(`/m/${id}`);
  const btn = page.getByRole("button", { name: /^Add to combo tray/ });
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await expect(async () => {   // a tap before the page has hydrated does nothing: tap again until the leg is in the tray
    if (await btn.isVisible()) await btn.click({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /^In combo/ })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
};

test("Premium, 3 legs: the tray and /check/combo show the same chance and payout", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, `wt3c-${Date.now()}@example.com`);
  await makePremium(page);
  await pageClockAtScan(page);
  const all = ((await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[]);
  const legs = all.filter((r, i) => all.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, 3);
  expect(legs).toHaveLength(3);
  for (const r of legs) await addToTray(page, r.market.id);
  await page.goto("/bets");
  const tray = page.getByTestId("combo-tray");
  await expect(tray).toBeVisible({ timeout: 30_000 });
  await tray.getByRole("button", { name: "Expand combo" }).click();
  const trayChance = (await tray.getByTestId("combo-chance").innerText()).match(/^(\d+%)/)![1]!;
  const trayPays = parseFloat((await tray.getByTestId("combo-pays").innerText()).replace("x", ""));
  await page.addInitScript(watchCls);
  await page.goto(`/check/combo?legs=${legs.map((r) => `${r.market.id}:${r.side.side_index}`).join(",")}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(3, { timeout: 30_000 });
  await page.waitForTimeout(800);
  const loadCls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  console.log(`CLS /check/combo with the tray at 1440px: ${loadCls.toFixed(4)}`);
  expect(loadCls).toBeLessThan(0.02);
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-mult")).toBeVisible({ timeout: 30_000 });
  const checkerChance = (await page.getByTestId("combo-chance").innerText()).trim();
  const checkerPays = parseFloat((await page.getByTestId("combo-mult").innerText()).replace("x", ""));
  console.log(`tray ${trayChance} / ${trayPays}x, checker ${checkerChance} / ${checkerPays}x`);
  expect(checkerChance).toBe(trayChance);
  expect(Math.abs(checkerPays - trayPays), "payouts agree to the tray's one decimal").toBeLessThan(0.051);
});

test("the tray refuses a second bet from the same event and names the combo checker (a link with both bets)", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, `wt3c-ev-${Date.now()}@example.com`);
  await makePremium(page);
  await pageClockAtScan(page);
  const all = ((await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[]);
  const byEvent = new Map<string, Row[]>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].find((l) => new Set(l.map((r) => r.market.id)).size >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const [a, b] = [...new Map(pair!.map((r) => [r.market.id, r])).values()];
  await addToTray(page, a!.market.id);
  await page.goto(`/m/${b!.market.id}`);
  const second = page.getByRole("button", { name: /^Add to combo tray/ });
  const alert = page.getByRole("alert").filter({ hasText: "Results in one event move together" });
  await expect(async () => { if (!(await alert.isVisible())) await second.click({ timeout: 3_000 }); await expect(alert).toBeVisible({ timeout: 5_000 }); }).toPass({ timeout: 60_000 });
  await expect(alert).toContainText("You can still check them together in the combo checker.");
  const link = alert.getByRole("link", { name: "combo checker" });
  const href = (await link.getAttribute("href"))!;
  expect(new URL(href, "http://x").searchParams.get("legs")).toBe(`${a!.market.id}:${a!.side.side_index},${b!.market.id}:${b!.side.side_index}`);
});

test("at 390 with the tray shown, 'Check this combo' can be scrolled above the tray and the tab bar", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, `wt3c-pad-${Date.now()}@example.com`);
  await makePremium(page);
  await pageClockAtScan(page);
  const all = ((await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[]);
  const legs = all.filter((r, i) => all.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, 2);
  for (const r of legs) await addToTray(page, r.market.id);
  await page.addInitScript(watchCls);
  await page.goto(`/check/combo?legs=${legs.map((r) => `${r.market.id}:${r.side.side_index}`).join(",")}`);
  const btn = page.getByTestId("combo-check-btn");
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("combo-tray")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));   // as far down as the page goes
  await page.waitForTimeout(500);
  const b = (await btn.boundingBox())!;
  const t = (await page.getByTestId("combo-tray").boundingBox())!;
  console.log(`button ${Math.round(b.y)}-${Math.round(b.y + b.height)}, tray ${Math.round(t.y)}-${Math.round(t.y + t.height)}`);
  expect(b.y + b.height, "the button ends above the tray").toBeLessThanOrEqual(t.y);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  console.log(`CLS /check/combo with the tray at 390px: ${cls.toFixed(4)}`);
  expect(cls).toBeLessThan(0.02);
});
