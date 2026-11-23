// Walk-through 1: the first visit from a shared bet link, signed out. /m teaser has the public facts (price, closes in),
// a locked verdict row and no run-together copy; /signup?next=/m/<id> names the bet (title read server-side); the header
// has no second "Sign up" button on the auth pages; /m CLS stays under 0.1.
import { expect, test } from "./fixtures";
import flagsFixture from "../test/fixtures/flags.json";

const id = (flagsFixture as unknown as { flags: { id: string }[] }).flags[0]!.id;   // the id a shared link would carry

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`shared bet -> teaser -> sign-up at ${w}px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const win = window as unknown as { __cls: number };
      win.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) win.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(`/m/${encodeURIComponent(id)}`);
    const t = page.getByTestId("teaser");
    await expect(t).toBeVisible({ timeout: 60_000 });
    const text = (await t.innerText()).replace(/\s+/g, " ");
    expect(text).toMatch(/get \d+ best bets a day/);          // the space after "get" survives
    await expect(page.getByTestId("teaser-price")).toHaveText(/\d+%/);
    await expect(page.getByTestId("teaser-closes-in")).toHaveText(/^(Closes in \S+|Closed)$/);
    await expect(page.getByTestId("teaser-verdict")).toContainText("Kismet's verdict");
    await expect(page.getByTestId("teaser-verdict")).toContainText(/sign.?up/i);
    expect(text).not.toMatch(/¢|\$\d|edge|win chance|Pays \d/i);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);

    await t.getByRole("link", { name: "Sign up free" }).click();
    await expect(page).toHaveURL(/\/signup\?next=/, { timeout: 60_000 });
    await expect(page.getByTestId("signup-bet")).toContainText("Sign up to see Kismet's verdict on");
    const head = page.getByRole("banner");
    // each auth page shows only the OTHER page's link in the header
    await expect(head.getByRole("link", { name: "Sign up", exact: true })).toHaveCount(0);
    await expect(head.getByRole("link", { name: "Log in", exact: true })).toBeVisible();
    await page.goto("/login");
    await expect(head.getByRole("link", { name: "Log in", exact: true })).toHaveCount(0);
    await expect(head.getByRole("link", { name: "Sign up", exact: true })).toBeVisible();
    await ctx.close();
  });
}

test("/signup ignores a title in the URL and a next that is not a market", async ({ page }) => {
  await page.goto(`/signup?next=${encodeURIComponent(`/m/${id}`)}&title=EVIL%20TITLE`);
  await expect(page.getByTestId("signup-bet")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("body")).not.toContainText("EVIL TITLE");
  await page.goto(`/signup?next=${encodeURIComponent("/m/does-not-exist")}`);
  await expect(page.getByRole("heading", { name: "Create your free account" })).toBeVisible();
  await expect(page.getByTestId("signup-bet")).toHaveCount(0);
  await page.goto("/signup");
  await expect(page.getByTestId("signup-bet")).toHaveCount(0);
});
