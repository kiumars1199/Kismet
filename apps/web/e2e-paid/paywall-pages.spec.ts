// docs/15 § Paywall (Lane X): server-rendered pages carry no more than the Free tier allows to a signed-out
// visitor. Checks the HTML + RSC payload itself, not what the UI happens to display.
import { expect, test } from "@playwright/test";
import type { MarketsResponse } from "@/lib/api";

const PAID_ONLY = ["capacity_usd", "limit_price", "limit_edge", "retention", "\"theta\"", "\"cov\""];

test("signed-out pages: no exact returns, no full price check, no model internals", async ({ page, request }) => {
  const flags = (await (await request.get("/api/flags?ps=200")).json()) as MarketsResponse;
  expect(flags.rows.length).toBeLessThanOrEqual(10);
  for (const r of flags.rows) expect(r.side.ranges).toBeDefined();
  const m = flags.rows[0]!.market;

  for (const path of ["/", "/bets", "/about", `/m/${m.id}`, `/event/${m.event_id}`]) {
    const html = await (await request.get(path)).text();
    for (const k of PAID_ONLY) expect(html, `${path} carries ${k}`).not.toContain(k);
    // Side objects in the RSC payload (escaped JSON) must carry their bands.
    const sides = html.match(/\\"side_index\\":[01]/g)?.length ?? 0;
    const ranges = html.match(/\\"ranges\\":\{/g)?.length ?? 0;
    expect(ranges, `${path}: every side has ranges`).toBeGreaterThanOrEqual(sides);
  }

  // docs/19 P1: a signed-out visitor's / is the landing; its one card is the gated top row.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Less luck, more math.");
  const hero = page.locator("[data-row]");
  if (await hero.count()) await expect(hero.first()).toContainText(/–|under|over/);

  // Best bets (/bets for a signed-out visitor) is client-rendered: its HTML has no market rows; the rows come from /api/flags (checked above).
  await page.goto("/bets");
  await expect(page.locator("[data-row]").first()).toBeVisible({ timeout: 30_000 });
  expect(await page.locator("[data-row]").count()).toBeLessThanOrEqual(10);
  await expect(page.locator("[data-row]").first()).toContainText(/–|under|over/);   // a band, not an exact figure

  await page.goto("/about");
  const card = page.getByTestId("preview-card").first();
  if (await card.count()) await expect(card).toContainText(/–|under|over/);
});
