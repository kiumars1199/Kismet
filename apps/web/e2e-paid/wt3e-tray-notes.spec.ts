// T-wt3e (#107 review notes), Premium: N4 a closed saved leg leaves the tray with a note that stays; N2 legs saved before the deploy are
// re-quoted on load, so the tray agrees with the checker for the same legs.
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
}
type ApiRow = { market: { id: string; question: string; event: string; event_id: string; url: string; closes_at: number }; side: { side_index: number; outcome: string; win_prob: number; win_prob_low: number } };
/** The tray's saved state as the app wrote it before this deploy: the old (international) ask and fee, no version mark. */
const savedLeg = (r: ApiRow, ask: number, fee: number, closes_at = r.market.closes_at) => ({
  market_id: r.market.id, side_index: r.side.side_index, question: r.market.question, outcome: r.side.outcome, event_id: r.market.event_id, event: r.market.event,
  url: r.market.url, kalshi_ticker: null, ask, fee, q: r.side.win_prob, q_low: r.side.win_prob_low, closes_at,
});
async function scanClock(page: Page) {
  const meta = (await (await page.request.get("/api/meta")).json()) as { meta: { scanned_at: number } };
  const at = meta.meta.scanned_at + 60;
  await page.clock.setFixedTime(new Date(at * 1000));   // the tray judges "closed" by the browser clock; the fixture scan is days old
  return at;
}
const seed = (page: Page, legs: unknown[]) => page.addInitScript((l) => localStorage.setItem("me-combo-v1", JSON.stringify({ state: { legs: l }, version: 0 })), legs);

test("N4: a saved leg that closed leaves the tray with 'One bet left your combo because it closed.', and the note stays", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, `wt3e-n4-${Date.now()}@example.com`);
  await makePremium(page);
  const at = await scanClock(page);
  const rows = ((await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as ApiRow[]);
  const [a, b, c] = rows.filter((r, i) => rows.findIndex((x) => x.market.event_id === r.market.event_id) === i);
  await seed(page, [savedLeg(a!, 0.5, 0.01, at + 86_400), savedLeg(b!, 0.5, 0.01, at + 86_400), savedLeg(c!, 0.5, 0.01, at - 3_600)]);   // the third closed an hour ago
  await page.goto("/bets");
  const note = page.getByTestId("combo-dropped");
  await expect(note).toHaveText("One bet left your combo because it closed.", { timeout: 30_000 });
  await page.waitForTimeout(3_000);   // it does not flash away on a rerender
  await expect(note).toBeVisible();
  await page.getByRole("link", { name: "All markets" }).first().click();   // a soft navigation keeps the layout, and the note
  await page.waitForURL(/\/markets/);
  await expect(page.getByTestId("combo-dropped")).toHaveText("One bet left your combo because it closed.");
});

test("N2: legs saved before the deploy are re-quoted: the tray and the checker agree for the same legs", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, `wt3e-n2-${Date.now()}@example.com`);
  await makePremium(page);
  const at = await scanClock(page);
  const rows = ((await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as ApiRow[]);
  const two = rows.filter((r, i) => rows.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, 2);
  await seed(page, two.map((r) => savedLeg(r, 0.9, 0.05, at + 86_400)));   // plainly wrong old numbers
  await page.goto(`/check/combo?legs=${two.map((r) => `${r.market.id}:${r.side.side_index}`).join(",")}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-mult")).toBeVisible({ timeout: 30_000 });
  const checkerPays = parseFloat((await page.getByTestId("combo-mult").innerText()).replace("x", ""));
  await page.goto("/bets");
  const tray2 = page.getByTestId("combo-tray");
  await expect(tray2).toBeVisible({ timeout: 30_000 });
  await tray2.getByRole("button", { name: "Expand combo" }).click();
  await expect.poll(async () => parseFloat((await tray2.getByTestId("combo-pays").innerText()).replace("x", "")), { timeout: 30_000 }).toBeGreaterThan(1.8);
  const finalPays = parseFloat((await tray2.getByTestId("combo-pays").innerText()).replace("x", ""));
  console.log(`tray ${finalPays}x, checker ${checkerPays}x`);
  expect(Math.abs(finalPays - checkerPays)).toBeLessThan(0.051);
});
