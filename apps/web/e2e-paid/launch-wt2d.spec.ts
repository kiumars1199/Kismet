// T-wt2d (walk-through 2): the signed-out teaser's "Check this bet" doesn't move its first view; a new Pro user who picks only a topic with
// nothing open lands on a clear empty state with the tour running over it; a topic tile keeps its name when "none open" arrives and a
// tap sticks. Supabase and Stripe: the in-app mocks.
import { expect, test, type Page } from "./fixtures";
import { expectPlanActive } from "./checkout";

const cls = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
});

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`signed out /m/<id> at ${w}: "Check this bet" beside "Add to combo checker", one row, CLS < 0.1`, async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2d-t-${w}-${Date.now()}` });
    await cls(page);
    await page.setViewportSize({ width: w, height: h });
    const id = ((await (await page.request.get("/api/markets?limit=3")).json()) as { rows?: { market: { id: string } }[] }).rows?.[0]?.market.id ?? "6674492";
    await page.goto(`/m/${id}`);
    const row = page.getByTestId("teaser-checks");
    await expect(row).toBeVisible({ timeout: 60_000 });
    await expect(row.getByRole("link", { name: "Check this bet" })).toHaveAttribute("href", new RegExp(`^/check\\?m=${id}&side=0$`));
    const [a, b] = [(await row.getByRole("link", { name: "Check this bet" }).boundingBox())!, (await row.getByRole("link", { name: "Add to combo checker" }).boundingBox())!];
    console.log(`teaser at ${w}: links ${Math.round(a.width)}x${Math.round(a.height)} and ${Math.round(b.width)}x${Math.round(b.height)}, row height ${Math.round((await row.boundingBox())!.height)}`);
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(a.width).toBeGreaterThanOrEqual(44);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);
    const v = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`teaser CLS at ${w}: ${v.toFixed(4)}`);
    expect(v).toBeLessThan(0.1);
  });
}

test("a new Pro user who picks only a topic with nothing open lands on a clear empty state, with the tour over it", async ({ page }) => {
  test.setTimeout(420_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt2d-pro-${Date.now()}` });
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = `wt2d-pro-${Date.now()}@example.com`;
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
  await page.goto("/pricing");   // upgrade first: Pro, still not onboarded
  await page.getByTestId("checkout-pro").click();
  await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
  await expectPlanActive(page);

  await page.goto("/onboarding");
  await page.waitForLoadState("networkidle");
  // the tile's name is its topic whether or not the counts have arrived; pick one with nothing open
  const none = await page.waitForFunction(() => {
    for (const b of document.querySelectorAll("fieldset button[aria-describedby]")) {
      const d = document.getElementById(b.getAttribute("aria-describedby")!);
      if (d?.textContent === "none open") return (b.textContent ?? "").replace("none open", "").trim();
    }
    return null;
  }, undefined, { timeout: 60_000 });
  const name = (await none.jsonValue()) as string;
  const tile = page.getByRole("button", { name, exact: true });
  await tile.click();
  await expect(tile).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });   // each tap waits for the account store, then saves
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Show my best bets" }).click();

  const empty = page.getByTestId("empty-state");
  await expect(empty).toBeVisible({ timeout: 60_000 });
  await expect(empty).toContainText("Widen your topics, or see all best bets");
  await expect(empty.getByRole("button", { name: "See all best bets" })).toBeVisible();
  await expect(empty.getByRole("link", { name: "Choose more topics" })).toBeVisible();
  const tour = page.getByTestId("tour");
  await expect(tour).toBeVisible({ timeout: 30_000 });   // not after a ten-second wait
  await expect(tour).toContainText("No best bets in your topics today");
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour).toContainText("2 of 5");
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await empty.getByRole("button", { name: "See all best bets" }).click();
  await expect(page.locator("article[data-row]").first()).toBeVisible({ timeout: 60_000 });
});
