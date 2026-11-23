// T-wt3 (walk-through 3): the combo checker has a way in for everyone, and its copy and layout are tidy. Fixture data, demo server.
import { expect, test, type Page } from "@playwright/test";

type Row = { market: { id: string; event_id: string }; side: { side_index: number } };
const rows = async (page: Page): Promise<Row[]> => (await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[];
const distinctEvents = (all: Row[], n: number) => all.filter((r, i) => all.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, n);
const addByUrl = async (page: Page, r: Row) => {
  const before = await page.getByTestId("combo-leg").count();
  await page.evaluate(([m, s]) => window.history.pushState(null, "", `/check/combo?m=${m}&side=${s}`), [r.market.id, String(r.side.side_index)]);
  await expect(page.getByTestId("combo-leg")).toHaveCount(before + 1, { timeout: 20_000 });
};
const SIZES = [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const;

for (const [name, size] of SIZES) {
  test(`/check has a "Check a combo" link to /check/combo at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/check");
    const link = page.getByRole("link", { name: "Check a combo" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/check/combo");
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL(/\/check\/combo$/);
    await expect(page.getByRole("heading", { name: "Combo checker" })).toBeVisible();
  });

  test(`the drawer and /m have "Add to combo checker" (opens /check/combo with the leg) at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/bets");
    await page.locator("[data-row] h3 a").first().click();
    const dialog = page.getByRole("dialog", { name: "Market details" });
    const link = dialog.getByRole("link", { name: "Add to combo checker" });
    await expect(link).toBeVisible();
    const href = (await link.getAttribute("href"))!;
    expect(href).toMatch(/^\/check\/combo\?m=[^&]+&side=[01]$/);
    const id = new URL(href, "http://x").searchParams.get("m")!;
    await link.click();
    await expect(page).toHaveURL(/\/check\/combo\?m=/);
    await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 20_000 });
    await page.goto(`/m/${id}`);
    await expect(page.getByRole("link", { name: "Add to combo checker" })).toHaveAttribute("href", href);
  });
}

test("legs already chosen are kept when another bet is added from its drawer or page", async ({ page }) => {
  const [a, b] = distinctEvents(await rows(page), 2);
  await page.goto(`/check/combo?m=${a!.market.id}&side=${a!.side.side_index}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 20_000 });
  await page.goto(`/m/${b!.market.id}`);
  await page.getByRole("link", { name: "Add to combo checker" }).click();
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 20_000 });   // survives a reload in the same tab
});

test("same-event legs: no score ('—'), the formula line says why, chance and pays stay", async ({ page }) => {
  const all = await rows(page);
  const byEvent = new Map<string, Row[]>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].find((l) => new Set(l.map((r) => r.market.id)).size >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const [a, b] = [...new Map(pair!.map((r) => [r.market.id, r])).values()];
  await page.goto("/check/combo");
  await addByUrl(page, a!);
  await addByUrl(page, b!);
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-same-event")).toContainText("move together");
  await expect(page.getByTestId("combo-score")).toHaveText("—");
  await expect(page.getByTestId("combo-formula")).toContainText("Not scored: legs from the same event");
  await expect(page.getByTestId("combo-chance")).not.toHaveText("—");
  await expect(page.getByTestId("combo-mult")).not.toHaveText("—");
  // the event name in the warning is the clean one
  expect(await page.getByTestId("combo-same-event").innerText()).not.toMatch(/more markets/i);
});

test("different events still get a score", async ({ page }) => {
  const [a, b] = distinctEvents(await rows(page), 2);
  await page.goto("/check/combo");
  await addByUrl(page, a!);
  await addByUrl(page, b!);
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-score")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("combo-formula")).not.toContainText("Not scored");
});

test("Why these numbers?: each leg's basis is the drawer's plain wording, not the model code", async ({ page }) => {
  const [a, b] = distinctEvents(await rows(page), 2);
  await page.goto("/check/combo");
  await addByUrl(page, a!);
  await addByUrl(page, b!);
  await page.getByTestId("combo-check-btn").click();
  await page.getByTestId("combo-why").locator("summary").click();
  const legs = page.getByTestId("combo-why-leg");
  await expect(legs).toHaveCount(2);
  for (const t of await legs.allInnerTexts()) {
    expect(t).toMatch(/(about \d+|over a thousand) similar past bets in /);
    expect(t).not.toMatch(/eff\. samples|Model:|level\)/);
  }
});

test("search hits are a dropdown over the page: the legs and the result below do not move", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/check/combo");
  const legs = page.getByTestId("combo-legs");
  const before = (await legs.boundingBox())!.y;
  await page.getByLabel("Add a bet by link or words").fill("Denmark");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const hits = page.getByTestId("combo-hits");
  await expect(hits).toBeVisible({ timeout: 20_000 });
  expect(await hits.evaluate((el) => getComputedStyle(el).position)).toBe("absolute");
  expect((await legs.boundingBox())!.y).toBe(before);
  await page.keyboard.press("Escape");
  await expect(hits).toHaveCount(0);
});

for (const [name, size] of SIZES) {
  test(`a scored combo does not shift the page: CLS < 0.02 at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const legs = distinctEvents(await rows(page), 2);   // the legs list reserves room for two
    await page.goto("/check/combo");
    for (const r of legs) await addByUrl(page, r);
    await page.getByTestId("combo-check-btn").click();
    await expect(page.getByTestId("combo-score")).toBeVisible();
    await page.waitForTimeout(1200);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`combo CLS at ${name}px: ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.02);
  });
}
