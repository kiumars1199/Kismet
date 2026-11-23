// Reviewer probe, F5 round 3: what a returning user sees once the 15-minute hint has expired (next day).
import { expect, test, type Page } from "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/node_modules/@playwright/test";
const SHOTS = "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/docs/launch/review/f05/round4";
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
  await signUp(page, `f05r4-${w}-${Date.now()}@example.com`);
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
  // next day, same browser: session cookies and the hint both remain (hint lasts ~1 year)
  await page.goto("about:blank");
  await page.waitForTimeout(2_000);
  for (const p of ["/bets", "/"]) {
    const r = await page.request.get(p, { maxRedirects: 0 });
    console.log(`${w} next day GET ${p} -> ${r.status()} ${r.headers()["location"] ?? ""}`);
  }
  await page.goto("/bets");
  console.log(`${w} next day first document: url=${page.url()} pill_in_first_paint=${await pill(page).count()}`);
  await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Skip tour" }); if (await skip.isVisible()) await skip.click();
  console.log(`${w} next day /bets url=${page.url()} pill=${await pill(page).count()}`);
  await page.screenshot({ path: `${SHOTS}/${w}-bets-next-day.png` });
  // cookie cleared / other browser with the same session (edge): first view
  await page.goto("about:blank");
  await context.clearCookies({ name: "me_topics" });
  const r3 = await page.request.get("/bets", { maxRedirects: 0 });
  console.log(`${w} hint cleared GET /bets -> ${r3.status()} ${r3.headers()["location"] ?? ""}`);
  // sign out, then signed-out request: hint gone
  await page.goto("/bets"); await page.waitForLoadState("networkidle");
  const so = await page.request.post("/api/auth/signout", { headers: { origin: new URL(page.url()).origin } }); console.log(`${w} signout -> ${so.status()}`);
  await page.goto("about:blank");
  const r4 = await page.request.get("/bets", { maxRedirects: 0 });
  const left = (await context.cookies()).find((x) => x.name === "me_topics");
  console.log(`${w} after signout GET /bets -> ${r4.status()} ${r4.headers()["location"] ?? ""} hint=${left ? decodeURIComponent(left.value) : "none"}`);
});
