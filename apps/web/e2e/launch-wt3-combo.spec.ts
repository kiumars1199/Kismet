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
    const link = page.locator("main").getByRole("link", { name: "Check a combo" });
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

// Review of #89: the empty state is compact (no big empty box for 0 or 1 legs), the tall result slot is held from the 1st leg on
// by the region around legs and result (so the page below never moves), and adding the 2nd leg and scoring each shift under 0.02.
for (const [name, size] of SIZES) {
  test(`the empty combo checker is compact, and the 2nd leg and the scoring each shift the page < 0.02 at ${name}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const cls = () => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    const legs = distinctEvents(await rows(page), 2);
    await page.goto("/check/combo");
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("/check/combo");
    await expect(page.getByTestId("combo-msg")).toBeVisible();
    const empty = await page.evaluate(() => ({ result: document.querySelector("section[aria-label='Combo result']")!.getBoundingClientRect().height, legs: document.querySelector("[data-testid=combo-legs]")!.getBoundingClientRect().height }));
    console.log(`empty state at ${name}px: result ${empty.result}px, legs list ${empty.legs}px`);
    expect(empty.result).toBeLessThan(200);
    expect(empty.legs).toBeLessThan(20);
    await addByUrl(page, legs[0]!);
    await page.waitForTimeout(600);
    const afterFirst = await cls();
    await addByUrl(page, legs[1]!);
    await page.waitForTimeout(800);
    const second = (await cls()) - afterFirst;
    await page.getByTestId("combo-check-btn").click();
    await expect(page.getByTestId("combo-score")).toBeVisible();
    await page.waitForTimeout(800);
    const scoring = (await cls()) - afterFirst - second;
    console.log(`combo CLS at ${name}px: 2nd leg ${second.toFixed(4)}, scoring ${scoring.toFixed(4)}`);
    expect(second).toBeLessThan(0.02);
    expect(scoring).toBeLessThan(0.02);
  });
}

test("on Premium the tray button says 'Add to combo tray' and the checker link stays beside it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/bets");
  await page.locator("[data-row] h3 a").first().click();
  const dialog = page.getByRole("dialog", { name: "Market details" });
  await expect(dialog.getByRole("button", { name: /^Add to combo tray/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Add to combo(?! tray)/ })).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "Add to combo checker" })).toBeVisible();
});

test("the desktop nav has 'Check a bet' (to /check) at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/bets");
  const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Check a bet" });
  await expect(link).toHaveAttribute("href", "/check");
  await link.click();
  await expect(page).toHaveURL(/\/check$/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Check a bet" })).toHaveAttribute("aria-current", "page");
});

// Review of #92 (T-89c): the first leg (a ?m= link, or legs kept from this tab) must not move the page: the legs list holds its height
// from the first paint when the server already knows a leg is coming, not after hydration. Each step < 0.02 at 390 and 1440,
// five fresh runs each, so one borderline run cannot pass.
const watchCls = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};
for (const [name, size] of SIZES) {
  test(`first leg, 2nd leg and scoring each shift the page < 0.02 at ${name}px (5 fresh runs)`, async ({ browser, page: seed }) => {
    test.setTimeout(240_000);
    const [a, b] = distinctEvents(await rows(seed), 2);
    const worst = { first: 0, second: 0, scoring: 0 };
    for (let run = 0; run < 5; run++) {
      const ctx = await browser.newContext({ viewport: size, baseURL: test.info().project.use.baseURL });
      const page = await ctx.newPage();
      await page.route("**/api/check/leg", async (r) => { await new Promise((ok) => setTimeout(ok, 700)); await r.continue(); });   // a slow lookup
      await page.addInitScript(watchCls);
      const cls = () => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      await page.goto(`/check/combo?m=${a!.market.id}&side=${a!.side.side_index}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 20_000 });
      await page.waitForTimeout(700);
      const first = await cls();
      await page.goto(`/check/combo?m=${b!.market.id}&side=${b!.side.side_index}`);   // the 1st leg comes back from this tab, the 2nd from the link
      await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 20_000 });
      await page.waitForTimeout(700);
      const second = await cls();   // a fresh page load: its own total
      const before = second;
      await page.getByTestId("combo-check-btn").click();
      await expect(page.getByTestId("combo-score")).toBeVisible();
      await page.waitForTimeout(700);
      const scoring = (await cls()) - before;
      worst.first = Math.max(worst.first, first); worst.second = Math.max(worst.second, second); worst.scoring = Math.max(worst.scoring, scoring);
      await ctx.close();
    }
    console.log(`T-89c CLS at ${name}px, worst of 5: first leg ${worst.first.toFixed(4)}, 2nd leg ${worst.second.toFixed(4)}, scoring ${worst.scoring.toFixed(4)}`);
    expect(worst.first).toBeLessThan(0.02);
    expect(worst.second).toBeLessThan(0.02);
    expect(worst.scoring).toBeLessThan(0.02);
  });
}

test("'2 to 10' is said once on /check/combo (not in the subtitle or the empty card as well)", async ({ page }) => {
  await page.goto("/check/combo");
  await expect(page.getByTestId("combo-msg")).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text.match(/2 to 10/g) ?? []).toHaveLength(1);
});

test("the phone More menu marks only the exact page as current: /check/combo is 'Check a combo', not 'Check a bet'", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/check/combo");
  await page.getByRole("button", { name: "More" }).click();
  const dialog = page.getByRole("dialog", { name: "More" });
  await expect(dialog.getByRole("link", { name: "Check a combo" })).toHaveAttribute("aria-current", "page");
  await expect(dialog.getByRole("link", { name: "Check a bet" })).not.toHaveAttribute("aria-current", "page");
  await page.goto("/check");
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("dialog", { name: "More" }).getByRole("link", { name: "Check a bet" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("dialog", { name: "More" }).getByRole("link", { name: "Check a combo" })).not.toHaveAttribute("aria-current", "page");
});
