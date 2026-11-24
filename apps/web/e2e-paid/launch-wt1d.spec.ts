// T-wt1d. (1) /signup?next=/m/<id> with the longest bet title: the visible line keeps the END of the title ("... on November 17?"), and
// "Create account" is above the tab bar (375x667, 390x844, 360x640) or inside the first screen (1440x900). (2) Free's and a signed-out
// visitor's home page: the card doesn't reserve the 52 px for "I placed this" and then drop it once the plan is known (CLS).
import flagsFixture from "../test/fixtures/flags.json";
import { expect, test, type Page } from "./fixtures";

const flags = (flagsFixture as unknown as { flags: { id: string; question: string }[] }).flags;
const longest = [...flags].sort((a, b) => b.question.length - a.question.length)[0]!;
const SIZES = [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 360, height: 640 }];

test.describe("the longest bet title on /signup?next=", () => {
  test.use({ hasTouch: true });
  for (const size of SIZES) {
    test(`at ${size.width}x${size.height}: the line ends with the date, and Create account is at least 8 px above ${size.width < 768 ? "the tab bar" : "the fold"}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`);
      const line = page.getByTestId("signup-bet");
      await expect(line).toBeVisible({ timeout: 60_000 });
      const shown = (await line.evaluate((e) => (e as HTMLElement).innerText)).trim();
      const tail = longest.question.slice(-15);   // "... on November 17?"
      console.log(`${size.width}x${size.height}: "${shown}"`);
      expect(shown, "the end of the title (the date) is in the line").toContain(tail);
      expect(shown, "the line still says to sign up").toMatch(/^Sign up for the verdict on: /);
      // innerText still holds text a line clamp hides: nothing may be hidden (the date is the end of the line, so it shows)
      expect(await line.evaluate((e) => e.scrollHeight - e.clientHeight), "no line of the bet title is clipped").toBeLessThanOrEqual(1);
      const submit = page.getByRole("tabpanel").getByRole("button", { name: "Create account", exact: true });
      const b = (await submit.boundingBox())!;
      const limit = size.width < 768 ? await page.getByRole("navigation", { name: "Main" }).evaluate((n) => n.getBoundingClientRect().top) : size.height;
      console.log(`${size.width}x${size.height}: Create account bottom ${Math.round(b.y + b.height)}, limit ${Math.round(limit)}`);
      expect(b.y + b.height).toBeLessThanOrEqual(limit - 8);
    });
  }
});

async function freeState(browser: import("@playwright/test").Browser, origin: string) {
  const ctx = await browser.newContext({ baseURL: origin, extraHTTPHeaders: { "x-e2e-device": `wt1d-${Date.now()}` } });
  const page = await ctx.newPage();
  const email = `wt1d-${Date.now()}@example.com`;
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
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

const cardsCls = async (page: Page, path: string, settleMs: number) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(path);
  await expect(page.getByTestId("bet-card").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(settleMs);   // the plan becomes known (/api/me) a few seconds in: that is when the card used to shrink
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
};

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`Free home page at ${size.width}: no shift when the plan becomes known (worst of 3 cold loads under 0.005), and the cards keep one height`, async ({ browser }) => {
    test.setTimeout(400_000);
    const origin = test.info().project.use.baseURL!;
    const state = await freeState(browser, origin);
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ baseURL: origin, viewport: size, storageState: state });
      const page = await ctx.newPage();
      runs.push(await cardsCls(page, "/", 6_000));
      if (i === 0) {   // and the first card is the same height at the start and the end
        const h = await page.getByTestId("bet-card").first().evaluate((e) => e.getBoundingClientRect().height);
        await page.reload();
        await page.getByTestId("bet-card").first().waitFor();
        const early = await page.getByTestId("bet-card").first().evaluate((e) => e.getBoundingClientRect().height);
        await page.waitForTimeout(6_000);
        const late = await page.getByTestId("bet-card").first().evaluate((e) => e.getBoundingClientRect().height);
        console.log(`Free card height at ${size.width}: settled ${Math.round(h)}, right after reload ${Math.round(early)}, 6 s later ${Math.round(late)}`);
        expect(Math.abs(early - late), "the card height doesn't change when the plan becomes known").toBeLessThan(1);
      }
      await ctx.close();
    }
    console.log(`Free home CLS at ${size.width}: ${runs.map((x) => x.toFixed(4)).join(", ")}`);
    expect(Math.max(...runs)).toBeLessThan(0.005);
  });

  test(`signed-out home page at ${size.width}: the same (no 52 px dropped once the plan is known)`, async ({ browser }) => {
    test.setTimeout(240_000);
    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL!, viewport: size });
      runs.push(await cardsCls(await ctx.newPage(), "/", 6_000));
      await ctx.close();
    }
    console.log(`signed-out home CLS at ${size.width}: ${runs.map((x) => x.toFixed(4)).join(", ")}`);
    expect(Math.max(...runs)).toBeLessThan(0.005);
  });
}
