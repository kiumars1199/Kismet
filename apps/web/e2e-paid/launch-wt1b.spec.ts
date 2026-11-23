// T-wt1b: the shared-bet first visit, signed out, touch. Fixes from the official walk-through 1 (prod 137ad1f):
// "Sign up free" sits right after the verdict row and clears the tab bar; /signup names the bet without "?." and keeps
// "Create account" above the tab bar; the Market price line; /state has an h1; the Sign up tab is the current page on
// /signup; auth links are 44 px tall; CLS stays under 0.1 on /m, /signup and /state.
import flagsFixture from "../test/fixtures/flags.json";
import { expect, test, type Page } from "./fixtures";

const flags = (flagsFixture as unknown as { flags: { id: string; question: string }[] }).flags;
const id = flags[0]!.id;
// the longest real title: the bet line on /signup must still leave "Create account" above the tab bar
const longId = [...flags].sort((a, b) => b.question.length - a.question.length)[0]!.id;
const SIZES = [{ width: 390, height: 844 }, { width: 375, height: 667 }];

const tabTop = (page: Page) => page.getByRole("navigation", { name: "Main" }).evaluate((n) => n.getBoundingClientRect().top);
const box = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())!;

test.use({ hasTouch: true });

for (const size of SIZES) {
  test(`/m teaser at ${size.width}x${size.height}: Sign up free is right after the verdict and clears the tab bar by 24 px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`/m/${id}`);
    await expect(page.getByTestId("teaser")).toBeVisible({ timeout: 60_000 });
    const verdict = await box(page.getByTestId("teaser-verdict"));
    const signup = await box(page.getByRole("link", { name: "Sign up free" }));
    const combo = await box(page.getByRole("link", { name: "Add to combo checker" }));
    expect(signup.y, "Sign up free follows the verdict row").toBeGreaterThanOrEqual(verdict.y + verdict.height);
    expect(signup.y - (verdict.y + verdict.height), "directly after (no other block between)").toBeLessThan(40);
    expect(combo.y, "the combo link is below Sign up free").toBeGreaterThanOrEqual(signup.y + signup.height);
    expect(signup.y + signup.height, "button bottom is >= 24 px above the tab bar").toBeLessThanOrEqual((await tabTop(page)) - 24);
    await expect(page.getByTestId("teaser-price")).toHaveText(/^Market price: \S+ \d+%$/);
  });
}

test("/m: the Log in link is >= 44 x 44", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/m/${id}`);
  await expect(page.getByTestId("teaser")).toBeVisible({ timeout: 60_000 });   // same wait as the other /m tests (cold next dev compile)
  const login = await box(page.getByTestId("teaser").getByRole("link", { name: "Log in" }));
  expect(login.width).toBeGreaterThanOrEqual(44);
  expect(login.height).toBeGreaterThanOrEqual(44);
});

test("/signup?next=/m/<id> at 390x844: Create account above the tab bar, no '?.', Sign up tab is current, links 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/signup?next=${encodeURIComponent(`/m/${longId}`)}`);
  const line = page.getByTestId("signup-bet");
  await expect(line).toBeVisible({ timeout: 60_000 });
  expect((await line.innerText()).trim()).not.toMatch(/[?!.]\.$/);
  const tab = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sign up" });
  await expect(tab).toHaveAttribute("aria-current", "page");
  const submit = await box(page.getByRole("button", { name: "Create account" }));
  console.log(`signup 390: Create account bottom ${Math.round(submit.y + submit.height)}, tab bar top ${Math.round(await tabTop(page))}`);
  expect(submit.y + submit.height, "Create account is above the tab bar").toBeLessThanOrEqual(await tabTop(page));
  for (const name of ["Terms", "Privacy Policy", "Log in"]) {
    const l = page.getByRole("main").getByRole("link", { name, exact: true }).last();
    const b = await box(l);
    expect(b.height, `${name} height`).toBeGreaterThanOrEqual(44);
    expect(b.width, `${name} width`).toBeGreaterThanOrEqual(44);
  }
  // the Terms/Privacy links are outside the 18+ checkbox label, so they never share its hit area
  expect(await page.getByRole("main").getByRole("link", { name: "Terms", exact: true }).evaluate((a) => !!a.closest("label"))).toBe(false);
});

test("/login at 390: 'Create a free account' and the terms links are >= 44 px tall", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  for (const name of ["Create a free account", "Terms", "Privacy Policy"]) {
    const b = await box(page.getByRole("main").getByRole("link", { name, exact: true }));
    expect(b.height, `${name} height`).toBeGreaterThanOrEqual(44);
  }
});

test("/state has an h1 'Your state'", async ({ page }) => {
  await page.goto("/state");
  await expect(page.getByRole("heading", { level: 1, name: "Your state" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Your state" })).toHaveCount(0);
});

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  for (const path of [`/m/${id}`, `/signup?next=${encodeURIComponent(`/m/${id}`)}`, "/state"]) {
    test(`CLS under 0.1: ${path.split("?")[0]!.replace(id, "<id>")} at ${w}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, baseURL: test.info().project.use.baseURL, hasTouch: w < 768 });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const win = window as unknown as { __cls: number };
        win.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) win.__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_000);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      console.log(`CLS ${path.split("?")[0]!.replace(id, "<id>")} at ${w}: ${cls.toFixed(4)}`);
      expect(cls).toBeLessThan(0.1);
      await ctx.close();
    });
  }
}
