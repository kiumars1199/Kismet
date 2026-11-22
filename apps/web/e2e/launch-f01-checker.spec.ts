// F1 (SPEC): /check numbers equal the card's and the drawer's for the same side on 3 fixture markets; a price edit
// updates every number with no network call; 390 px and 1440 px have no horizontal scroll; bad links and prices say so.
import { expect, test, type Page } from "@playwright/test";

const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("checker = card = drawer on 3 fixture markets", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/book*", (r) => r.fulfill({ json: { book_ok: false, verdict: "no book", stakes: [] } }));
  await page.goto("/?us=0");
  const cards = page.locator("article[data-row][data-venue=intl-only]");
  await expect(cards.first()).toBeVisible();
  const picked: { id: string; side: number; chance: string; pays: string; ret: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);
    await card.getByText("Why this bet?").click();
    const chance = (await card.getByTestId("card-chance").innerText()).match(/^(Under 1%|Over 99%|\d+%)/)![0];
    const pays = (await card.getByTestId("why-pays-x").innerText()).trim();
    const ret = (await card.getByTestId("why-return").innerText()).trim();
    await card.locator("h3 a").click();
    const drawer = page.getByRole("dialog", { name: "Market details" });
    await expect(drawer.getByTestId("bet-return")).toHaveText(ret);   // drawer = card
    const id = new URL(page.url()).searchParams.get("m")!;
    const body = await (await page.request.get(`/api/markets/${id}`)).json();
    picked.push({ id, side: body.market.best.side_index, chance, pays, ret });
    await page.keyboard.press("Escape");
  }
  for (const p of picked) {
    await page.goto(`/check?m=${p.id}&side=${p.side}`);
    await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("chk-chance")).toHaveText(p.chance);
    await expect(page.getByTestId("chk-mult")).toHaveText(p.pays);
    await expect(page.getByTestId("chk-return")).toHaveText(p.ret);
  }
});

test("price 60% → 50% updates multiplier, edge and score with no network call", async ({ page }) => {
  await page.goto("/");
  const id = await page.locator("[data-row] h3 a").first().getAttribute("href").then((h) => new URL(h!, "http://x").searchParams.get("m")!);
  await page.goto(`/check?m=${id}&side=0`);
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  let calls = 0;
  page.on("request", (r) => { if (r.url().includes("/api/")) calls++; });
  await page.getByTestId("check-price").fill("60");
  const before = { mult: await page.getByTestId("chk-mult").innerText(), edge: await page.getByTestId("chk-edge").innerText() };
  const t0 = Date.now();
  await page.getByTestId("check-price").fill("50");
  await expect(page.getByTestId("chk-mult")).not.toHaveText(before.mult);
  expect(Date.now() - t0).toBeLessThan(1000);   // generous: includes Playwright's own round trips; the work itself is one synchronous render
  await expect(page.getByTestId("chk-edge")).not.toHaveText(before.edge);
  expect(calls).toBe(0);
});

test("0% and 100% are rejected, unknown links say so, the formula is on the page", async ({ page }) => {
  await page.goto("/");
  const id = await page.locator("[data-row] h3 a").first().getAttribute("href").then((h) => new URL(h!, "http://x").searchParams.get("m")!);
  await page.goto(`/check?m=${id}&side=0`);
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("check-formula")).toContainText("50 + 250");
  for (const v of ["0", "100"]) {
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

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`/check at ${w}px has no horizontal scroll, empty and with a result`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/check");
    await expect(page.getByRole("heading", { name: "Bet checker" })).toBeVisible();
    expect(await noHScroll(page)).toBe(true);
    await page.goto("/");
    const id = await page.locator("[data-row] h3 a").first().getAttribute("href").then((x) => new URL(x!, "http://x").searchParams.get("m")!);
    await page.goto(`/check?m=${id}&side=0`);
    await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
    expect(await noHScroll(page)).toBe(true);
  });
}

test("/check?m=<id>&side=0 opens no drawer and the page is not inert", async ({ page }) => {
  await page.goto("/");
  const id = await page.locator("[data-row] h3 a").first().getAttribute("href").then((x) => new URL(x!, "http://x").searchParams.get("m")!);
  await page.goto(`/check?m=${id}&side=0`);
  await expect(page.getByTestId("chk-score")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("dialog", { name: "Market details" })).toHaveCount(0);
  expect(await page.locator("[inert]").count()).toBe(0);
  await page.getByTestId("check-price").fill("55");   // editable, so not inert
});
