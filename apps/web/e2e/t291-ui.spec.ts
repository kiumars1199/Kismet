// T-291 (outside tester, production): "Show more" under "More bets with an edge" appends and keeps the scroll
// position; a filter change shows a loading state, never the previous filter's list; /status names the engine.
import { expect, test, type Route } from "@playwright/test";


test("More bets with an edge: Show more appends cards and keeps the scroll position", async ({ page }) => {
  // The fixture has a single edge-tier bet, so serve the Best bets pages as the edge tier: enough groups for Show more.
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/api\/flags\?.*tier=edge/, async (route: Route) => {
    const url = new URL(route.request().url());
    url.searchParams.delete("tier");
    url.searchParams.delete("wp");
    if (Number(url.searchParams.get("pg") ?? 1) > 1) await gate;   // hold page 2 so the test can look while it loads
    await route.fulfill({ response: await route.fetch({ url: url.toString() }) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const section = page.getByTestId("more-edge");
  await expect(async () => {   // useNear: the section fetches once it comes close to the viewport (after hydration)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(section).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  const cards = section.locator("[data-row]");
  const before = await cards.count();
  expect(before).toBeGreaterThan(0);
  const firstId = await cards.first().getAttribute("data-market-id");

  const more = section.getByRole("button", { name: /^Show more/ });
  await more.scrollIntoViewIfNeeded();
  const y0 = await page.evaluate(() => window.scrollY);
  expect(y0).toBeGreaterThan(500);
  await more.click();

  // while page 2 loads, the cards already shown stay (the old code emptied the section and jumped to the top)
  await expect(section.getByRole("button", { name: "Loading…" })).toBeVisible();
  await expect(cards).toHaveCount(before);
  await expect(cards.first()).toHaveAttribute("data-market-id", firstId!);
  release();

  await expect.poll(() => cards.count()).toBeGreaterThan(before);
  await expect(cards.first()).toHaveAttribute("data-market-id", firstId!);
  const y1 = await page.evaluate(() => window.scrollY);
  expect(Math.abs(y1 - y0)).toBeLessThan(200);
});

test("Best bets: a filter change shows the loading state, never the previous list", async ({ page }) => {
  await page.goto("/");
  const list = page.locator("main [data-row]");
  await expect(list.first()).toBeVisible();
  const oldIds = await list.evaluateAll((els) => els.slice(0, 4).map((e) => (e as HTMLElement).dataset.marketId));

  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/api\/flags\?.*x0=5/, async (route) => { await gate; await route.continue(); });
  await page.getByRole("button", { name: "Pays 5x+" }).click();
  await expect(page).toHaveURL(/x0=5/);

  await expect(page.getByRole("list", { name: "Loading best bets" })).toBeVisible();
  for (const id of oldIds) await expect(page.locator(`main [data-row][data-market-id="${id}"]`)).toHaveCount(0);
  release();
  await expect(page.getByRole("list", { name: "Loading best bets" })).toHaveCount(0);
});
