// T-wt3: every plan can reach the combo checker: signed out, Free and Pro, at 390 and 1440, from /check and from the drawer (or /m).
// Premium's tray and suggested combos stay Premium's; Free sees its daily-check note, Pro does not.
import { expect, test, type Page } from "./fixtures";
import { expectPlanActive } from "./checkout";

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/account");
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
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}


const SIZES = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];

async function fromCheck(page: Page) {
  await page.goto("/check");
  const link = page.getByRole("link", { name: "Check a combo" });
  await expect(link).toBeVisible();
  await expect(async () => {   // next dev can still be hydrating when the first tap lands: tap again until the page has moved
    if (!/\/check\/combo/.test(page.url())) await link.click({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/check\/combo$/, { timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Combo checker" })).toBeVisible();
}
/** Signed in: a card's drawer on /bets. */
async function fromDrawer(page: Page) {
  await page.goto("/bets");
  await page.locator("[data-row] h3 a").first().click();
  const dialog = page.getByRole("dialog", { name: "Market details" });
  const link = dialog.getByRole("link", { name: "Add to combo checker" });
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("button", { name: /^Add to combo tray/ })).toHaveCount(0);   // the Premium tray is not shown to Free or Pro
  // next dev can still be hydrating when the first tap lands: tap again until the page has moved
  await expect(async () => {
    if (!/\/check\/combo/.test(page.url())) await link.click({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/check\/combo\?m=/, { timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("combo-leg"), `note: ${await page.getByTestId("combo-note").innerText().catch(() => "?")}`).toHaveCount(1, { timeout: 30_000 });
}

test("signed out: /check and a bet's page lead to the combo checker at 390 and 1440", async ({ page }) => {
  test.setTimeout(180_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3-${Date.now()}` });
  for (const size of SIZES) {
    await page.setViewportSize(size);
    if (size.width >= 1024) {   // the desktop nav leads to /check for signed-out visitors too
      await page.goto("/about");
      await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Check a bet" })).toHaveAttribute("href", "/check");
    }
    await fromCheck(page);
    await page.goto("/m/6674492");   // the signed-out teaser page
    const link = page.getByRole("link", { name: "Add to combo checker" });
    await expect(link).toBeVisible();
    await expect(async () => {
      if (!/\/check\/combo/.test(page.url())) await link.click({ timeout: 3_000 });
      await expect(page).toHaveURL(/\/check\/combo\?m=6674492/, { timeout: 8_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
    await page.evaluate(() => sessionStorage.clear());
  }
});

test("Free, then Pro: both reach the combo checker from /check and the drawer; /combos says what they have; only Free sees the check note", async ({ page }) => {
  test.setTimeout(420_000);
  await signIn(page, `wt3-${Date.now()}@example.com`);
  const ids = ((await (await page.request.get("/api/markets?limit=20")).json()).rows as { market: { id: string }; side: { side_index: number } }[]);
  expect(ids.length).toBeGreaterThanOrEqual(2);

  for (const plan of ["free", "pro"] as const) {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await fromCheck(page);
      await page.evaluate(() => sessionStorage.clear());
      await fromDrawer(page);
      await page.evaluate(() => sessionStorage.clear());
      // /combos: the checker is theirs, suggested combos and the tray are Premium's
      await page.goto("/combos");
      const box = page.getByTestId("combos-upgrade");
      await expect(box).toContainText("Check any combo you build in the combo checker.");
      await expect(box).toContainText("Premium adds suggested combos and the combo tray.");
      await expect(box.getByRole("link", { name: "Check any combo you build in the combo checker." })).toHaveAttribute("href", "/check/combo");
    }
    // the check note: two legs make "Check this combo" appear
    for (const [i, r] of ids.slice(0, 2).entries()) {   // a full load each: the first leg is kept in sessionStorage for the second
      await page.goto(`/check/combo?m=${r.market.id}&side=${r.side.side_index}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(i + 1, { timeout: 30_000 });
    }
    await expect(page.getByTestId("combo-check-btn")).toBeVisible();
    if (plan === "free") await expect(page.getByTestId("combo-free-note")).toHaveText("Free includes 1 check a day; this combo counts as one.");
    else await expect(page.getByTestId("combo-free-note")).toHaveText("");
    await page.evaluate(() => sessionStorage.clear());
    if (plan === "free") {
      await page.goto("/pricing");
      await page.getByTestId("checkout-pro").click();
      await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
      await expectPlanActive(page);
    }
  }
});

// Review of #89: Free's limit box is part of the result (inside it), so it never pushes the legs down; no shift > 0.02 at 390 or 1440.
test("Free: the daily-limit box sits inside the result and moves nothing (CLS < 0.02 at 390 and 1440)", async ({ page }) => {
  test.setTimeout(240_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3-limit-${Date.now()}` });
  await signIn(page, `wt3-limit-${Date.now()}@example.com`);
  const rows = ((await (await page.request.get("/api/markets?limit=20")).json()).rows as { market: { id: string }; side: { side_index: number } }[]);
  // use the day's one check, so the combo below hits the limit
  const used = await page.request.post("/api/check", { data: { m: rows[0]!.market.id, side: 0 }, headers: { Origin: new URL(page.url()).origin } });
  expect(used.status()).toBe(200);
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/check/combo");
    await page.evaluate(() => sessionStorage.clear());
    for (const [i, r] of rows.slice(1, 3).entries()) {
      await page.goto(`/check/combo?m=${r.market.id}&side=${r.side.side_index}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(i + 1, { timeout: 30_000 });
    }
    await page.waitForTimeout(800);
    const legsTop = (await page.getByTestId("combo-legs").boundingBox())!.y;
    const before = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    await page.getByTestId("combo-check-btn").click();
    const box = page.getByTestId("check-upgrade");
    await expect(box).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    expect(await page.getByRole("region", { name: "Combo result" }).getByTestId("check-upgrade").count(), "inside the result").toBe(1);
    expect((await page.getByTestId("combo-legs").boundingBox())!.y).toBe(legsTop);
    const delta = (await page.evaluate(() => (window as unknown as { __cls: number }).__cls)) - before;
    console.log(`limit box CLS at ${size.width}px: ${delta.toFixed(4)}`);
    expect(delta).toBeLessThan(0.02);
  }
});
