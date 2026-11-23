// Reviewer probe, F14: the chart card for Free, Pro and Premium at 390 and 1440 (E2E mock, next dev).
import { expect, test, type Page } from "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/node_modules/@playwright/test";
const SHOTS = "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/docs/launch/review/f14/paid";
async function signUp(page: Page, email: string) {
  await page.goto("/login");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 90_000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await page.waitForURL(/\/onboarding/, { timeout: 90_000 });
}
for (const w of [390, 1440]) test(`F14 chart per tier at ${w}px`, async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  await signUp(page, `f14-${w}-${Date.now()}@example.com`);
  const me = await (await page.request.get("/api/me")).json();
  for (const tier of ["free", "pro", "premium"]) {
    if (tier !== "free") await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier } });
    const t = (await (await page.request.get("/api/me")).json()).tier;
    for (const id of ["6674492", "7078474"]) {
      const api = await (await page.request.get(`/api/markets/${id}/history`)).json();
      const metaScan = (await (await page.request.get(`/api/meta`)).json());
      await page.goto(`/m/${id}`);
      const card = page.getByTestId("price-history");
      await page.getByTestId(id === "6674492" ? "history-chart" : "history-empty").waitFor({ timeout: 90_000 });
      const h = (await card.boundingBox())!.height;
      const basis = await page.getByTestId("history-basis").innerText();
      console.log(`${w} ${tier}(me=${t}) ${id} status-points=${api.points.length} as_of=${api.as_of} scanned=${JSON.stringify(metaScan.scanned_at ?? metaScan.meta?.scanned_at ?? null)} cardH=${h} basis="${basis}"`);
      expect(h).toBe(360);
      await card.screenshot({ path: `${SHOTS}/${w}-${tier}-${id}-card.png` });
    }
  }
});
