// F1 (SPEC): /check numbers equal the card's and the drawer's for the same side on 3 fixture markets (chance, market %, multiplier,
// edge, return); a price edit updates every number in under 100 ms with no network call; 390 px and 1440 px have no horizontal
// scroll and CLS < 0.1; the Check link on a card lands on the result; bad links and prices say so.
import { expect, test, type Page } from "@playwright/test";

const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const firstId = async (page: Page) => {
  await page.goto("/");
  return page.locator("[data-row] h3 a").first().getAttribute("href").then((h) => new URL(h!, "http://x").searchParams.get("m")!);
};
/** Layout-shift score of the page load (CLS), collected from before any script runs. */
const watchCls = (page: Page) => page.addInitScript(() => {
  (window as unknown as { __cls: number }).__cls = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
});
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

test("checker = card = drawer on 3 fixture markets: chance, market %, multiplier, edge, return", async ({ page }) => {
  test.setTimeout(150_000);
  await page.route("**/api/book*", (r) => r.fulfill({ json: { book_ok: false, verdict: "no book", stakes: [] } }));
  await page.goto("/?us=0");
  const cards = page.locator("article[data-row][data-venue=intl-only]");
  await expect(cards.first()).toBeVisible();
  const picked: { id: string; side: number; chance: string; market: string; pays: string; ret: string; edge: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);
    await card.getByText("Why this bet?").click();
    const chance = (await card.getByTestId("card-chance").innerText()).match(/^(Under 1%|Over 99%|\d+%)/)![0];
    const pays = (await card.getByTestId("why-pays-x").innerText()).trim();
    const market = (await card.getByTestId("why-pays").innerText()).match(/Price (\d+%)/)![1]!;
    const ret = (await card.getByTestId("why-return").innerText()).trim();
    await card.locator("h3 a").click();
    const drawer = page.getByRole("dialog", { name: "Market details" });
    await expect(drawer.getByTestId("bet-return")).toHaveText(ret);   // drawer = card
    const edge = (await drawer.getByTestId("verdict").innerText()).match(/\(([^)]+)\)/)![1]!;   // the drawer's points: "+24 pts"
    const id = new URL(page.url()).searchParams.get("m")!;
    const body = await (await page.request.get(`/api/markets/${id}`)).json();
    picked.push({ id, side: body.market.best.side_index, chance, market, pays, ret, edge });
    await page.keyboard.press("Escape");
  }
  for (const p of picked) {
    await page.goto(`/check?m=${p.id}&side=${p.side}`);
    await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("chk-chance")).toHaveText(p.chance);
    await expect(page.getByTestId("chk-market")).toHaveText(p.market);
    await expect(page.getByTestId("chk-mult")).toHaveText(p.pays);
    await expect(page.getByTestId("chk-edge")).toHaveText(p.edge);
    await expect(page.getByTestId("chk-return")).toHaveText(p.ret);
  }
});

test("price 60% → 50% updates multiplier, edge and score in under 100 ms with no network call", async ({ page }) => {
  const id = await firstId(page);
  await page.goto(`/check?m=${id}&side=0`);
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  let calls = 0;
  page.on("request", (r) => { if (r.url().includes("/api/")) calls++; });
  await page.getByTestId("check-price").fill("60");
  const before = { mult: await page.getByTestId("chk-mult").innerText(), edge: await page.getByTestId("chk-edge").innerText(), score: await page.getByTestId("chk-score").innerText() };
  // measured in the page: from the input event to the DOM showing the new numbers
  const ms = await page.evaluate(async () => {
    const el = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    const input = el("check-price") as HTMLInputElement;
    const old = { mult: el("chk-mult").textContent, edge: el("chk-edge").textContent, score: el("chk-score").textContent };
    const t0 = performance.now();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "50");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    while (el("chk-mult").textContent === old.mult || el("chk-edge").textContent === old.edge) {
      if (performance.now() - t0 > 2000) return 2000;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(100);
  expect(await page.getByTestId("chk-mult").innerText()).not.toBe(before.mult);
  expect(await page.getByTestId("chk-edge").innerText()).not.toBe(before.edge);
  expect(calls).toBe(0);
});

test("0%, 100%, 0.5% and 99.5% are rejected, unknown links say so, the formula is on the page", async ({ page }) => {
  const id = await firstId(page);
  await page.goto(`/check?m=${id}&side=0`);
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("check-formula")).toContainText("50 + 250");
  for (const v of ["0", "100", "0.5", "99.5"]) {
    await page.getByTestId("check-price").fill(v);
    await expect(page.getByTestId("check-error")).toContainText("between 1% and 99%");
  }
  await page.getByTestId("check-price").fill("50");
  await page.getByTestId("check-stake").fill("0");
  await expect(page.getByTestId("check-error")).toContainText("$1 and $100,000");
  await page.goto("/check");
  await page.getByLabel("Market link or words").fill("https://polymarket.com/event/definitely-not-a-real-market");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByTestId("check-missing")).toContainText("We couldn't find an open market at that link");
});

test("the venue line matches the card: International only, not on Polymarket US", async ({ page }) => {
  await page.goto("/?us=0");
  const card = page.locator("article[data-row][data-venue=intl-only]").first();
  const id = await card.getAttribute("data-market-id");
  const side = await card.getByTestId("check-link").getAttribute("href").then((h) => new URL(h!, "http://x").searchParams.get("side"));
  await page.goto(`/check?m=${id}&side=${side}`);
  await expect(page.getByTestId("check-venue")).toHaveText("International only, not on Polymarket US");
});

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`/check at ${w}px: no horizontal scroll, CLS < 0.1 loading ?m=, empty and with a result`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/check");
    await expect(page.getByRole("heading", { name: "Bet checker" })).toBeVisible();
    expect(await noHScroll(page)).toBe(true);
    const id = await firstId(page);
    await watchCls(page);
    await page.goto(`/check?m=${id}&side=0`);
    await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect(await noHScroll(page)).toBe(true);
    expect(await cls(page)).toBeLessThan(0.1);
  });
}

test("Check on a card at /bets, 390px, lands on that bet's result with the card's numbers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bets");
  const card = page.locator("article[data-row]").first();
  await expect(card).toBeVisible();
  const chance = (await card.getByTestId("card-chance").innerText()).match(/^(Under 1%|Over 99%|\d+%)/)![0];
  const id = await card.getAttribute("data-market-id");
  await card.getByTestId("check-link").click();
  await expect(page).toHaveURL(new RegExp(`/check\\?m=${id}&side=[01]`));
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("chk-chance")).toHaveText(chance);
  expect(await noHScroll(page)).toBe(true);
});

test("every card on /, /bets and /markets has a Check link to /check?m=…&side=…", async ({ page }) => {
  for (const path of ["/", "/bets", "/markets"]) {
    await page.goto(path);
    await expect(page.locator("[data-row]").first()).toBeVisible();
    const rows = await page.locator("[data-row]").count();
    expect(rows, path).toBeGreaterThan(0);
    await expect(page.locator("[data-row] [data-testid=check-link]"), path).toHaveCount(rows);
    await expect(page.locator("[data-row] [data-testid=check-link]").first(), path).toHaveAttribute("href", /^\/check\?m=[^&]+&side=[01]$/);
  }
});

test("/check?m=<id>&side=0 opens no drawer and the page is not inert", async ({ page }) => {
  const id = await firstId(page);
  await page.goto(`/check?m=${id}&side=0`);
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("dialog", { name: "Market details" })).toHaveCount(0);
  expect(await page.locator("[inert]").count()).toBe(0);
  await page.getByTestId("check-price").fill("55");   // editable, so not inert
});
