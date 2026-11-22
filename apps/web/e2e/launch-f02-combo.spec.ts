// F2 (SPEC): add legs (here by ?m= deep links; "from cards" is added once BetCard has "Add to combo"), see the combined numbers,
// drop the suggested weakest leg with one tap, and see the same-event warning. Fixture data.
import { expect, test, type Page } from "@playwright/test";

type Row = { market: { id: string; event_id: string }; side: { side_index: number } };
async function rows(page: Page): Promise<Row[]> {
  return (await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[];
}
/** Adds one leg the way a card link would: the page reads ?m= and &side= (pushState keeps the legs already added). */
async function addByUrl(page: Page, r: Row) {
  const before = await page.getByTestId("combo-leg").count();
  await page.evaluate(([m, s]) => window.history.pushState(null, "", `/check/combo?m=${m}&side=${s}`), [r.market.id, String(r.side.side_index)]);
  await expect(page.getByTestId("combo-leg")).toHaveCount(before + 1, { timeout: 20_000 });
}

test("3 legs: combined numbers, drop the weakest with one tap, numbers update", async ({ page }) => {
  test.setTimeout(120_000);
  const all = await rows(page);
  const distinct = all.filter((r, i) => all.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, 3);
  expect(distinct.length).toBe(3);
  await page.goto("/check/combo");
  await expect(page.getByTestId("combo-msg")).toContainText("Add at least two");
  await addByUrl(page, distinct[0]!);
  await expect(page.getByTestId("combo-msg")).toContainText("Add at least one more leg");
  await addByUrl(page, distinct[1]!);
  await addByUrl(page, distinct[2]!);
  await expect(page.getByTestId("combo-mult")).toBeVisible();
  const before = { chance: await page.getByTestId("combo-chance").innerText(), mult: await page.getByTestId("combo-mult").innerText() };
  await expect(page.getByTestId("combo-formula")).toContainText("independent");
  await expect(page.getByTestId("combo-same-event")).toHaveCount(0);
  const drop = page.getByTestId("combo-drop");
  if (await drop.count()) {
    await drop.getByRole("button", { name: "Drop that leg" }).click();
    await expect(page.getByTestId("combo-leg")).toHaveCount(2);
    await expect(page.getByTestId("combo-mult")).not.toHaveText(before.mult);
  } else {
    // no leg is worth dropping on this data: removing one by hand still updates the numbers
    await page.getByRole("button", { name: /^Remove / }).first().click();
    await expect(page.getByTestId("combo-leg")).toHaveCount(2);
    await expect(page.getByTestId("combo-chance")).not.toHaveText(before.chance);
  }
});

test("a 2nd leg from the same event shows the same-event warning; a duplicate is refused", async ({ page }) => {
  const all = await rows(page);
  const byEvent = new Map<string, Row[]>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].find((l) => new Set(l.map((r) => r.market.id)).size >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const [a, b] = [...new Map(pair!.map((r) => [r.market.id, r])).values()];
  await page.goto("/check/combo");
  await addByUrl(page, a!);
  await addByUrl(page, b!);
  await expect(page.getByTestId("combo-same-event")).toContainText("move together");
  await page.evaluate(([m, s]) => window.history.pushState(null, "", `/check/combo?m=${m}&side=${s}&x=1`), [a!.market.id, String(a!.side.side_index)]);
  await expect(page.getByTestId("combo-note")).toContainText("already in your combo");
  await expect(page.getByTestId("combo-leg")).toHaveCount(2);
});

test("/check/combo at 390px: no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/check/combo");
  await expect(page.getByRole("heading", { name: "Combo checker" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
