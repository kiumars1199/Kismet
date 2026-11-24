// T-wt1c (#97 review): with Google sign-in ON (as production), the submit button on /signup, /signup?next= and /login is fully above the tab
// bar in the first view at 375x667 (touch), and still good at 390x844 and 1440. The password field has a visible hint under it that
// aria-describedby points at (it had become a placeholder only). CLS on /login, /signup and /state: worst of 5 cold loads at 375, 390 and 1440.
import flagsFixture from "../test/fixtures/flags.json";
import { expect, test, type Page } from "./fixtures";

const flags = (flagsFixture as unknown as { flags: { id: string; question: string }[] }).flags;
const longId = [...flags].sort((a, b) => b.question.length - a.question.length)[0]!.id;   // the longest bet line on /signup?next=
const SIZES = [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1440, height: 900 }];
const PAGES: { name: string; path: string; button: string; desktopPath?: string }[] = [
  { name: "/signup", path: "/signup", button: "Create account" },
  { name: "/signup?next=/m/<id>", path: `/signup?next=${encodeURIComponent(`/m/${longId}`)}`, button: "Create account", desktopPath: `/signup?next=${encodeURIComponent(`/m/${flags[0]!.id}`)}` },
  { name: "/login", path: "/login", button: "Log in" },
];

test.use({ hasTouch: true });
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Main" });

for (const size of SIZES) for (const p of PAGES) {
  test(`${p.name} at ${size.width}x${size.height} with Google on: "${p.button}" is fully visible in the first view${size.width < 768 ? ", above the tab bar" : ""}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(size.width >= 768 && p.desktopPath ? p.desktopPath : p.path);   // the longest bet line is the phone case; the desktop first view is judged with a typical one
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible({ timeout: 60_000 });   // Google really is on
    const submit = page.getByRole("tabpanel").getByRole("button", { name: p.button, exact: true });
    await expect(submit).toBeVisible();
    const b = (await submit.boundingBox())!;
    const limit = size.width < 768 ? await tabBar(page).evaluate((n) => n.getBoundingClientRect().top) : size.height;
    console.log(`${p.name} ${size.width}x${size.height}: ${p.button} bottom ${Math.round(b.y + b.height)}, ${size.width < 768 ? "tab bar top" : "viewport bottom"} ${Math.round(limit)}`);
    expect(b.y + b.height, `${p.button} bottom is at least 8 px above ${size.width < 768 ? "the tab bar" : "the viewport bottom"}`).toBeLessThanOrEqual(limit - 8);   // with a little air, not touching
  });
}

test("/signup: the password hint is visible under the field and aria-describedby points at it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  const pw = page.locator("input").and(page.getByLabel("Password", { exact: true }));
  await expect(pw).toBeVisible({ timeout: 60_000 });
  const id = await pw.getAttribute("aria-describedby");
  expect(id, "aria-describedby is set").toBeTruthy();
  const hint = page.locator(`[id="${id}"]`);
  await expect(hint).toBeVisible();
  await expect(hint).toContainText("At least 8 characters");
  const [f, h] = [(await pw.boundingBox())!, (await hint.boundingBox())!];
  expect(h.y, "the hint sits under the field").toBeGreaterThanOrEqual(f.y + f.height - 1);
  expect(h.y - (f.y + f.height), "and right under it").toBeLessThan(24);
});

test("the password hint doesn't wrap the Show button or shift when Show is toggled", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/signup");
  const show = page.getByRole("button", { name: "Show password" });
  await expect(show).toBeVisible({ timeout: 60_000 });
  const before = (await page.getByRole("button", { name: "Create account", exact: true }).boundingBox())!.y;
  await show.click();
  expect((await page.getByRole("button", { name: "Create account", exact: true }).boundingBox())!.y).toBe(before);
});

// CLS: worst of 5 cold loads (a fresh context each), every page at 375, 390 and 1440
const MEASURED = [{ name: "/login", path: "/login" }, { name: "/signup", path: "/signup" }, { name: "/state", path: "/state" }];
for (const size of SIZES) for (const m of MEASURED) {
  test(`CLS ${m.name} at ${size.width}: worst of 5 cold loads under 0.1, disclaimer present, no cents`, async ({ browser }) => {
    test.setTimeout(240_000);
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const ctx = await browser.newContext({ viewport: size, hasTouch: size.width < 768, baseURL: test.info().project.use.baseURL });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(m.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1_000);
      runs.push(await page.evaluate(() => (window as unknown as { __cls: number }).__cls));
      if (i === 0) {
        await expect(page.locator("footer")).toContainText("Market analytics, not financial advice. Based on past results. 18+.");
        expect(await page.locator("main").innerText()).not.toMatch(/\d\s?¢|\$\d+\.\d{2}|cents/i);
      }
      await ctx.close();
    }
    console.log(`CLS ${m.name} at ${size.width}: ${runs.map((x) => x.toFixed(4)).join(", ")} (worst ${Math.max(...runs).toFixed(4)})`);
    expect(Math.max(...runs)).toBeLessThan(0.1);
  });
}
