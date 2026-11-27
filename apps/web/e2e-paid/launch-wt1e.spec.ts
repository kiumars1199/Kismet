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
      (window as unknown as { fits: (t: string) => boolean }).fits = (t) => { (p.firstChild as Text).nodeValue = lede + t; return p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1; };   // two lines, and not wider than the box
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
const RIO = "Will the highest temperature in Rio de Janeiro be 29°C or higher on November 18 according to the official station?";
SIBLINGS.push(
  [RIO, RIO.replace(" or higher", "")],
  [RIO.replace(" or higher", " or below"), RIO.replace(" or higher", "")],
  [RIO.replace(" or higher", ""), RIO.replace(" or higher", "").replace("highest", "lowest")],
  ["Will initial jobless claims be fewer than 225,000 for the week ending November 15 according to the Department of Labor?", "Will initial jobless claims be at 225,000 for the week ending November 15 according to the Department of Labor?"],
  ["Will initial jobless claims be greater than 225,000 for the week ending November 15 according to the Department of Labor?", "Will initial jobless claims be at 225,000 for the week ending November 15 according to the Department of Labor?"],
);
// T-wt1f (review 3, break-it set): more words that decide which bet it is, and "by/in/on" before a date
const btc = (x: string) => `Will the price of Bitcoin ${x} on Coinbase at 12:00 PM Eastern Time on Friday November 27, 2026?`;
const rio2 = (x: string) => `Will the highest temperature in Rio de Janeiro on Tuesday November 24 be ${x} according to the official station?`;
const nfl = (x: string) => `Will Patrick Mahomes throw for ${x} passing yards in the Kansas City Chiefs vs Las Vegas Raiders game on Thanksgiving?`;
const CHIEFS = (x: string) => `Will the Kansas City Chiefs finish the 2026 NFL regular season in the ${x} 5 of the AFC standings according to NFL.com?`;
SIBLINGS.push(
  [CHIEFS("top"), CHIEFS("bottom")],
  [btc("reach $95,000"), btc("dip to $95,000")],
  [btc("drop to $95,000"), btc("hit $95,000")],
  [rio2("between 28°C and 29°C"), rio2("outside 28°C and 29°C")],
  ["Will the minimum temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?", "Will the maximum temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?"],
  ["Will the min temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?", "Will the max temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?"],
  ["Will the US Bureau of Economic Analysis report positive real GDP growth for the third quarter of 2026 in its advance estimate?", "Will the US Bureau of Economic Analysis report negative real GDP growth for the third quarter of 2026 in its advance estimate?"],
  [btc("reach $95,000 by November 30"), btc("reach $95,000 on November 30")],
  ["Will the Federal Reserve announce an emergency cut to the federal funds target range by December 2026 according to the FOMC statement?", "Will the Federal Reserve announce an emergency cut to the federal funds target range in December 2026 according to the FOMC statement?"],
  [nfl("at least 285"), nfl("285")],
  [nfl("at least 285"), nfl("at most 285")],
  ["Which team will allow the fewest points across all games of the 2026 NFL regular season through Week 12 according to ESPN?", "Which team will allow the most points across all games of the 2026 NFL regular season through Week 12 according to ESPN?"],
  ["Will the highest temperature in Rio de Janeiro during the weekend of November 28-29 be 29°C according to the official station?", "Will the highest temperature in Rio de Janeiro during the weekday of November 28-29 be 29°C according to the official station?"],
);
// T-wt1g (review 3 follow-ups): inflected direction words, first vs last, "up to"
const ten = (x: string) => `Will Novak Djokovic ${x} Carlos Alcaraz in the 2026 Nitto ATP Finals round-robin stage match in Turin, Italy on Sunday?`;
const ten3 = (x: string) => `Novak Djokovic ${x} Carlos Alcaraz in the 2026 Nitto ATP Finals round-robin stage match in Turin, Italy on Sunday?`;
const f1 = (x: string) => `Will Max Verstappen finish ${x} in the 2026 Abu Dhabi Grand Prix at the Yas Marina Circuit according to official FIA results?`;
const chiefs2 = (x: string) => `Will the Kansas City Chiefs ${x} the Las Vegas Raiders at halftime of the Thanksgiving Day game at Arrowhead Stadium in Kansas City?`;
SIBLINGS.push(
  [ten("beat"), ten("lose to")],
  [ten3("beats"), ten3("loses to")],
  [ten3("wins against"), ten3("loses against")],
  [ten3("won against"), ten3("lost against")],
  [chiefs2("lead"), chiefs2("trail")],
  [f1("first"), f1("last")],
  [f1("1st"), f1("last")],
  [f1("first"), f1("second")],
  [f1("second"), f1("third")],
  ["Will the earliest US snowfall of 1 inch or more in Atlanta, Georgia during the 2026-27 winter season happen in December?", "Will the latest US snowfall of 1 inch or more in Atlanta, Georgia during the 2026-27 winter season happen in December?"],
  [nfl("up to 285"), nfl("at least 285")],
  [nfl("up to 285"), nfl("285")],
);
for (const size of SIZES) {
  test(`${size.width}: direction siblings (increase/decrease, hike/cut, raise/lower) render different lines`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`);
    await expect(line(page)).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => line(page).evaluate((e) => e.scrollHeight - e.clientHeight), { timeout: 30_000 }).toBeLessThanOrEqual(1);
    await page.waitForTimeout(2_000);
    await page.evaluate((lede) => {
      const p = document.querySelector('[data-testid="signup-bet"]') as HTMLElement;
      (window as unknown as { fits: (t: string) => boolean }).fits = (t) => { (p.firstChild as Text).nodeValue = lede + t; return p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1; };   // two lines, and not wider than the box
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
