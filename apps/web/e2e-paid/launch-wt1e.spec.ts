// T-wt1e: the bet line on /signup?next= shows the whole title when it fits 2 lines, and shortens it (filler, then names, then the middle) only as
// far as needed, measured in the real box; "Create account" holds the fold at 360x640, 390x844 and 1440x900; the H1 doesn't ride up under the
// site header on a short phone; and over every distinct title in output/flags.json almost no two bets read as the same line.
import { readFileSync } from "node:fs";
import flagsFixture from "../test/fixtures/flags.json";
import { clampCandidates } from "../lib/fit-clamp";
import { expect, test, type Page } from "./fixtures";

const fixtureFlags = (flagsFixture as unknown as { flags: { id: string; question: string }[] }).flags;
const longest = [...fixtureFlags].sort((a, b) => b.question.length - a.question.length)[0]!;
const shortest = [...fixtureFlags].sort((a, b) => a.question.length - b.question.length)[0]!;
const LEDE = "Sign up for the verdict on: ";
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }];

test.use({ hasTouch: true });
const tabTop = (page: Page) => page.getByRole("navigation", { name: "Main" }).evaluate((n) => n.getBoundingClientRect().top);
const line = (page: Page) => page.getByTestId("signup-bet");

for (const size of SIZES) {
  test(`${size.width}x${size.height}: a title that fits is shown whole; the longest is shortened, keeps its end and the button holds the fold`, async ({ page }) => {
    await page.setViewportSize(size);
    // a short title: whole, untouched
    await page.goto(`/signup?next=${encodeURIComponent(`/m/${shortest.id}`)}`);
    await expect(line(page)).toBeVisible({ timeout: 60_000 });
    await expect(line(page)).toHaveText(LEDE + shortest.question);
    // the longest: shortened only if it must be
    await page.goto(`/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`);
    await expect(line(page)).toBeVisible({ timeout: 60_000 });
    await expect(line(page)).toHaveText(new RegExp(`^${LEDE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    // the fit runs once the page has hydrated (seconds on a cold CI server): wait for the line to reach two lines, nothing clipped
    await expect.poll(() => line(page).evaluate((e) => e.scrollHeight - e.clientHeight), { timeout: 30_000 }).toBeLessThanOrEqual(1);
    const shown = (await line(page).evaluate((e) => (e as HTMLElement).innerText)).trim();
    const whole = LEDE + longest.question;
    console.log(`${size.width}x${size.height}: ${shown === whole ? "whole" : `shortened: "${shown}"`}`);
    expect(await line(page).evaluate((e) => e.scrollHeight - e.clientHeight), "two lines, nothing clipped").toBeLessThanOrEqual(1);
    expect(shown.endsWith(longest.question.slice(-12)), "the end of the title (the date) is shown").toBe(true);
    const b = (await page.getByRole("tabpanel").getByRole("button", { name: "Create account", exact: true }).boundingBox())!;
    const limit = size.width < 768 ? await tabTop(page) : size.height;
    console.log(`${size.width}x${size.height}: Create account bottom ${Math.round(b.y + b.height)}, limit ${Math.round(limit)}`);
    expect(b.y + b.height).toBeLessThanOrEqual(limit - 8);
  });
}

test("a web-font swap after the first measure re-fits the line (wider letters: still 2 lines, the end kept)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto(`/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`);
  await expect(line(page)).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => line(page).evaluate((e) => e.scrollHeight - e.clientHeight), { timeout: 30_000 }).toBeLessThanOrEqual(1);   // hydrated and fitted
  await page.evaluate(() => { document.body.style.letterSpacing = "0.6px"; document.fonts.dispatchEvent(new Event("loadingdone")); });   // the font "arrives" wider
  await expect.poll(async () => line(page).evaluate((e) => e.scrollHeight - e.clientHeight), { timeout: 5_000 }).toBeLessThanOrEqual(1);
  const shown = (await line(page).evaluate((e) => (e as HTMLElement).innerText)).trim();
  console.log(`wider letters at 360: "${shown}"`);
  // a re-measure that finds the same answer must leave the line as it was: the search's last probe is not the answer (this left a clipped third line on CI)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
    await page.waitForTimeout(150);
    expect(await line(page).evaluate((e) => e.scrollHeight - e.clientHeight), `after ${i + 1} idle re-measures`).toBeLessThanOrEqual(1);
    expect((await line(page).evaluate((e) => (e as HTMLElement).innerText)).trim()).toBe(shown);
  }
  expect(shown.endsWith(longest.question.slice(-12))).toBe(true);
});

for (const size of [{ width: 360, height: 640 }, { width: 375, height: 667 }]) {
  test(`${size.width}x${size.height}: the H1 sits below the site header (no overlap)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`);
    await expect(line(page)).toBeVisible({ timeout: 60_000 });
    const header = (await page.locator("header").first().boundingBox())!;
    const h1 = (await page.getByRole("heading", { level: 1 }).first().boundingBox())!;
    console.log(`${size.width}x${size.height}: header bottom ${Math.round(header.y + header.height)}, H1 top ${Math.round(h1.y)}`);
    expect(h1.y).toBeGreaterThanOrEqual(header.y + header.height + 8);
  });
}

// Every distinct title in the real output/flags.json, through the real fit in the real box (the same candidate list the page uses).
const REAL = [...new Set((JSON.parse(readFileSync("../../output/flags.json", "utf8")).flags as { question: string }[]).map((f) => f.question))];
for (const [size, maxClashes] of [[SIZES[0]!, 0], [SIZES[1]!, 0], [SIZES[2]!, 0]] as const) {
  test(`${size.width}: ${REAL.length} real titles: all fit 2 lines, at most 3% are shortened, and ${maxClashes} read as another bet's line`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize(size);
    await page.goto(`/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`);
    await expect(line(page)).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => line(page).evaluate((e) => e.scrollHeight - e.clientHeight), { timeout: 30_000 }).toBeLessThanOrEqual(1);   // hydrated and fitted: then the page's own effects are done
    await page.waitForTimeout(2_000);   // (and its timed re-measures at 0.4 s and 1.5 s)
    await page.evaluate((lede) => {
      const p = document.querySelector('[data-testid="signup-bet"]') as HTMLElement;
      (window as unknown as { fits: (t: string) => boolean }).fits = (t) => { (p.firstChild as Text).nodeValue = lede + t; return p.scrollHeight <= p.clientHeight + 1; };
    }, LEDE);
    const fits = (t: string) => page.evaluate((x) => (window as unknown as { fits: (t: string) => boolean }).fits(x), t);
    const seen = new Map<string, string>(); const clashes: string[] = []; let shortened = 0, overflow = 0;
    for (const t of REAL) {
      const c = clampCandidates(t);
      let lo = 0, hi = c.length - 1, best = c[hi]!;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (await fits(c[mid]!)) { best = c[mid]!; hi = mid - 1; } else lo = mid + 1; }
      if (!(await fits(best))) overflow++;
      if (best !== t) shortened++;
      const prev = seen.get(best);
      if (prev !== undefined && prev !== t) clashes.push(`${prev} | ${t} -> ${best}`);
      seen.set(best, t);
    }
    console.log(`REAL ${size.width}: ${REAL.length} titles, ${shortened} shortened (${(100 * shortened / REAL.length).toFixed(1)}%), ${overflow} over 2 lines, ${clashes.length} clashes\n${clashes.join("\n")}`);
    expect(overflow).toBe(0);
    expect(shortened / REAL.length, "a title is shortened only when it has to be").toBeLessThan(0.03);
    expect(clashes.length).toBeLessThanOrEqual(maxClashes);
  });
}

// T-wt1f: the word that says which way a rate moves survives the fit, in the real box: siblings never read as the same line.
const DECREASE = "Will the Bank of Israel decrease the Bank of Israel Interest Rate by 25 bps at the November meeting?";
const SIBLINGS: [string, string][] = [
  [DECREASE, DECREASE.replace("decrease", "increase")],
  ["Will the Federal Reserve hike interest rates by 25 bps at the December meeting?", "Will the Federal Reserve cut interest rates by 25 bps at the December meeting?"],
  ["Will the Bank of England raise the Bank Rate by 50 bps at the December meeting?", "Will the Bank of England lower the Bank Rate by 50 bps at the December meeting?"],
];
for (const size of SIZES) {
  test(`${size.width}: direction siblings (increase/decrease, hike/cut, raise/lower) render different lines`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`);
    await expect(line(page)).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => line(page).evaluate((e) => e.scrollHeight - e.clientHeight), { timeout: 30_000 }).toBeLessThanOrEqual(1);
    await page.waitForTimeout(2_000);
    await page.evaluate((lede) => {
      const p = document.querySelector('[data-testid="signup-bet"]') as HTMLElement;
      (window as unknown as { fits: (t: string) => boolean }).fits = (t) => { (p.firstChild as Text).nodeValue = lede + t; return p.scrollHeight <= p.clientHeight + 1; };
    }, LEDE);
    const fits = (t: string) => page.evaluate((x) => (window as unknown as { fits: (t: string) => boolean }).fits(x), t);
    const shorten = async (t: string) => {
      const c = clampCandidates(t);
      let lo = 0, hi = c.length - 1, best = c[hi]!;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (await fits(c[mid]!)) { best = c[mid]!; hi = mid - 1; } else lo = mid + 1; }
      return best;
    };
    for (const [a, b] of SIBLINGS) {
      const [la, lb] = [await shorten(a), await shorten(b)];
      console.log(`SIBLINGS ${size.width}: "${la}"  vs  "${lb}"`);
      expect(la).not.toBe(lb);
    }
  });
}
