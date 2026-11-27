// F9: before every bet button the card says whether the venue is available in the visitor's state. The state is chosen
// in /settings (saved in a cookie). Restricted state: international Polymarket is blocked for the US (official page), so
// the intl link inside "Why this bet?" says "not available in <state>", above the link. Polymarket US lists Nevada as the
// only unavailable state (polymarket.us/trust), so Nevada says not available and other states say available. Kalshi has no
// published per-state list (unverified), so it says "Check Kalshi for <state>".
import { expect, test } from "@playwright/test";

test("no state chosen: 'Check your state' above each bet button, linking to Settings", async ({ page }) => {
  await page.goto("/bets");
  await expect(page.getByTestId("bet-card").first()).toBeVisible({ timeout: 30_000 });
  const buttons = await page.getByTestId("venue-button").count();
  expect(buttons).toBeGreaterThan(0);
  expect(await page.locator('[data-testid="venue-availability"] + [data-testid="venue-button"]').count()).toBe(buttons);
  const first = page.getByTestId("venue-availability").first();
  await expect(first).toHaveText("Check your state");
  await expect(first.getByRole("link")).toHaveAttribute("href", /^\/state\?next=%2F/);
});

test("restricted state: the note says not available, above the button, at 390 px and 1440 px", async ({ page }) => {
  await page.goto("/settings");
  // picking before React attaches its handler is lost (the controlled value snaps back to ""): wait for hydration
  await expect.poll(() => page.getByTestId("state-select").evaluate((n) => Object.keys(n).some((k) => k.startsWith("__reactProps$"))), { timeout: 30_000 }).toBe(true);
  await page.getByTestId("state-select").selectOption("NV");
  await expect(page.getByTestId("state-select")).toHaveValue("NV");
  await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "us_state")?.value).toBe("NV");

  for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await page.goto("/?us=0&g=0&ps=50");
    await expect(page.getByTestId("bet-card").first()).toBeVisible({ timeout: 30_000 });

    // US-listed bets: Polymarket US is restricted in Nevada, directly above the button
    const buttons = await page.getByTestId("venue-button").count();
    expect(await page.locator('[data-testid="venue-availability"] + [data-testid="venue-button"]').count()).toBe(buttons);
    await expect(page.locator('[data-testid="venue-availability"]:has(+ [data-testid="venue-button"])').first()).toHaveText("Polymarket US: not available in Nevada");

    // international-only bet: Polymarket international is blocked for US residents
    const intl = page.locator("article[data-venue=intl-only]").first();
    await intl.getByText("Why this bet?").click();
    const note = intl.getByTestId("why-intl").getByTestId("venue-availability");
    await expect(note).toHaveText("Polymarket: not available in Nevada");
    await expect(note).toHaveAttribute("data-status", "restricted");
    const [noteBox, linkBox] = await Promise.all([note.boundingBox(), intl.getByTestId("why-intl").getByRole("link", { name: "Open on international Polymarket" }).boundingBox()]);
    expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(linkBox!.y + 1);   // the note sits above the link
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("an unknown state is refused and clearing works", async ({ page }) => {
  await page.goto("/settings");
  const base = new URL(page.url()).origin;
  expect((await page.request.post("/api/state", { data: { state: "ZZ" }, headers: { origin: base } })).status()).toBe(400);
  expect((await page.request.post("/api/state", { data: { state: "tx" }, headers: { origin: base } })).status()).toBe(204);
  expect((await page.request.post("/api/state", { data: { state: null }, headers: { origin: base } })).status()).toBe(204);
});

test("Polymarket US says available in a state its Trust page does not restrict", async ({ page }) => {
  await page.goto("/settings");
  await page.getByTestId("state-select").selectOption("TX");
  await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "us_state")?.value).toBe("TX");
  await page.goto("/?us=0&g=0&ps=50");
  await expect(page.getByTestId("bet-card").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="venue-availability"]:has(+ [data-testid="venue-button"])').first()).toHaveText("Polymarket US: available in Texas");
});
