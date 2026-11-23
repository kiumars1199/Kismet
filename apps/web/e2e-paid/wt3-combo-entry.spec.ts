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
  await expect(dialog.getByRole("button", { name: /^Add to combo$/ })).toHaveCount(0);   // the Premium tray is not shown to Free or Pro
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
