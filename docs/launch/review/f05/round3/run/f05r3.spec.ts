// Reviewer probe, F5 round 3: what a returning user sees once the 15-minute hint has expired (next day).
import { expect, test, type Page } from "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/node_modules/@playwright/test";
const SHOTS = "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/docs/launch/review/f05/round3";
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
}
const pill = (page: Page) => page.getByRole("button", { name: "Remove filter: Your topics" });
for (const w of [390, 1440]) test(`returning after the hint expired at ${w}px`, async ({ page, context }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  await signUp(page, `f05r3-${w}-${Date.now()}@example.com`);
  const me = await (await page.request.get("/api/me")).json();
  await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" } });
  const nfl = page.getByRole("button", { name: /^NFL/ });
  await expect(nfl).toContainText("open", { timeout: 60_000 });
  await page.waitForTimeout(500);
  await nfl.click();
  await expect(nfl).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL(/fav=1/, { timeout: 60_000 });
  const c = (await context.cookies()).find((x) => x.name === "me_topics");
  console.log(`${w} hint=${decodeURIComponent(c!.value)} expires_in_s=${Math.round(c!.expires - Date.now() / 1000)}`);
  // simulate the next day: the session cookies remain, the 15-minute hint is gone
  await page.goto("about:blank");   // no open Kismet page polling /api/me, as on the next day
  await page.waitForTimeout(2_000);
  await context.clearCookies({ name: "me_topics" });
  for (const p of ["/bets", "/"]) {
    const r = await page.request.get(p, { maxRedirects: 0 });
    console.log(`${w} after expiry GET ${p} -> ${r.status()} ${r.headers()["location"] ?? ""}`);
  }
  await context.clearCookies({ name: "me_topics" });
  await page.goto("/bets");
  console.log(`${w} first document after expiry: url=${page.url()} pill_in_first_paint=${await pill(page).count()}`);
  await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Skip tour" }); if (await skip.isVisible()) await skip.click();
  console.log(`${w} after expiry /bets url=${page.url()} pill=${await pill(page).count()}`);
  await page.screenshot({ path: `${SHOTS}/${w}-bets-after-hint-expired.png` });
  const r2 = await page.request.get("/bets", { maxRedirects: 0 });
  console.log(`${w} second load GET /bets -> ${r2.status()} ${r2.headers()["location"] ?? ""}`);
});
