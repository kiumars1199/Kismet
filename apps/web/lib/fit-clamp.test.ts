// T-wt1e: the bet line on /signup?next= shows the whole title when it fits and, when it can't, drops filler words first, then names, then
// the deciding words, then cuts the middle: so two different bets never read as the same line. Checked on every distinct title in flags.json
// (the test fixture, and the real output/flags.json: 2,769 titles) with a character budget standing in for the browser's width measure.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clampCandidates, fitClamp } from "./fit-clamp";

const load = (p: string) => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as { flags: { question: string }[] }).flags.map((f) => f.question) : []);
const FIXTURE = [...new Set(load(join(__dirname, "..", "test", "fixtures", "flags.json")))];
const REAL = [...new Set(load(join(__dirname, "..", "..", "..", "output", "flags.json")))];
const LEDE = "Sign up for the verdict on: ";
const budget = (total: number) => (t: string) => (LEDE + t).length <= total;

describe("fitClamp", () => {
  it("returns the whole title when it fits", () => {
    expect(fitClamp("Denmark vs. Norway: O/U 2.5", budget(90))).toBe("Denmark vs. Norway: O/U 2.5");
  });
  it("drops filler first and keeps the city, the range and the date", () => {
    const t = "Will the highest temperature in Los Angeles be between 66-67°F on November 18?";
    const out = fitClamp(t, budget(92));   // "highest" and "between" are deciding words now, so they stay with the city
    expect(out).toContain("Los Angeles");
    expect(out).toContain("66-67°F");
    expect(out.endsWith("November 18?")).toBe(true);
    expect((LEDE + out).length).toBeLessThanOrEqual(92);
  });
  it("candidates only ever get shorter, start with the whole title and never run out", () => {
    for (const t of [...FIXTURE.slice(0, 40), "a".repeat(200), "x"]) {
      const c = clampCandidates(t);
      expect(c[0]).toBe(t);
      for (let i = 1; i < c.length; i++) expect(c[i]!.length).toBeLessThanOrEqual(c[i - 1]!.length);
      expect(c.length).toBeGreaterThan(0);
    }
  });
  it("a number is never the first thing to go: digits survive every step that still has filler or names to drop", () => {
    const t = "Will Donald Trump post 80-99 Truth Social posts from November 13 to November 20, 2026?";
    for (const c of clampCandidates(t).filter((x) => x.length >= 40)) expect(c).toContain("80-99");
  });
});

for (const [name, titles] of [["test fixture", FIXTURE], ["real output/flags.json", REAL]] as const) {
  describe.runIf(titles.length > 0)(`${name} (${titles.length} distinct titles)`, () => {
    for (const total of [86, 98, 110]) {
      it(`no two distinct titles render the same visible line (budget ${total} characters)`, () => {
        const seen = new Map<string, string>();
        const clashes: string[] = [];
        for (const t of titles) {
          const line = fitClamp(t, budget(total));
          const other = seen.get(line);
          if (other !== undefined && other !== t) clashes.push(`${other}  |  ${t}  ->  ${line}`);
          seen.set(line, t);
        }
        expect(clashes.slice(0, 5)).toEqual([]);
      });
    }
    it("a title that fits is never touched", () => {
      for (const t of titles.filter((x) => budget(90)(x))) expect(fitClamp(t, budget(90))).toBe(t);
    });
  });
}

// T-wt1f: the word that says which way a rate moves must survive, or "decrease 25 bps" and "increase 25 bps" read as the same bet.
const OPPOSITE: Record<string, string> = { increase: "decrease", decrease: "increase", hike: "cut", cut: "hike", raise: "lower", lower: "raise", above: "below", below: "above", yes: "no" };
const DECREASE = "Will the Bank of Israel decrease the Bank of Israel Interest Rate by 25 bps at the November meeting?";
const SIBLINGS: [string, string][] = [
  [DECREASE, DECREASE.replace("decrease", "increase")],
  ["Will the Federal Reserve hike interest rates by 25 bps at the December meeting?", "Will the Federal Reserve cut interest rates by 25 bps at the December meeting?"],
  ["Will the Bank of England raise the Bank Rate by 50 bps at the December meeting?", "Will the Bank of England lower the Bank Rate by 50 bps at the December meeting?"],
  ["Will the Bank of Israel make no change to the Bank of Israel Interest Rate at the November meeting?", "Will the Bank of Israel increase the Bank of Israel Interest Rate at the November meeting?"],
];
// T-wt1f (review 2): a threshold said two ways ("29°C or higher" / "29°C"), the other end of a range (highest / lowest) and "fewer than" / "at"
const RIO = "Will the highest temperature in Rio de Janeiro be 29°C or higher on November 18 according to the official station?";
SIBLINGS.push(
  [RIO, RIO.replace(" or higher", "")],
  [RIO.replace(" or higher", " or below"), RIO.replace(" or higher", "")],
  [RIO.replace(" or higher", ""), RIO.replace(" or higher", "").replace("highest", "lowest")],
  [RIO.replace(" or higher", " or higher").replace("highest", "lowest"), RIO.replace(" or higher", "")],
  ["Will initial jobless claims be fewer than 225,000 for the week ending November 15 according to the Department of Labor?", "Will initial jobless claims be at 225,000 for the week ending November 15 according to the Department of Labor?"],
  ["Will initial jobless claims be greater than 225,000 for the week ending November 15 according to the Department of Labor?", "Will initial jobless claims be at 225,000 for the week ending November 15 according to the Department of Labor?"],
  ["Will Bitcoin rise above $70,000 by the end of the week according to the CoinGecko daily price index?", "Will Bitcoin fall above $70,000 by the end of the week according to the CoinGecko daily price index?"],
  ["Will the Fed exceed 2 rate moves in the 2026 calendar year according to the CME FedWatch tool?", "Will the Fed make exactly 2 rate moves in the 2026 calendar year according to the CME FedWatch tool?"],
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
describe("direction words", () => {
  for (const total of [86, 98, 110]) {
    it(`siblings never render the same line (budget ${total})`, () => {
      for (const [a, b] of SIBLINGS) expect(fitClamp(a, budget(total)), `${a} | ${b}`).not.toBe(fitClamp(b, budget(total)));
    });
    it(`a repeated phrase goes before a distinct word (budget ${total}): 'Bank of Israel' is not said twice while 'decrease' is lost`, () => {
      const out = fitClamp(DECREASE, budget(total));
      expect(out).toContain("decrease");
      expect(out.match(/Israel/g)?.length ?? 0).toBeLessThanOrEqual(1);
    });
    it(`real titles with a direction word never match their opposite (budget ${total})`, () => {
      let pairs = 0;
      for (const t of REAL) {
        const w = t.split(" ").find((x) => OPPOSITE[x.replace(/\W/g, "").toLowerCase()]);
        if (!w) continue;
        const key = w.replace(/\W/g, "").toLowerCase();
        const other = t.replace(w, w.replace(new RegExp(key, "i"), OPPOSITE[key]!));
        pairs++;
        expect(fitClamp(t, budget(total)), `${t} | ${other}`).not.toBe(fitClamp(other, budget(total)));
      }
      if (REAL.length) expect(pairs).toBeGreaterThan(0);
    });
  }
});


describe("up to", () => {
  it("keeps the 'to' after 'up' (not 'up … 285')", () => {
    const t = "Will Patrick Mahomes throw for up to 285 passing yards in the Kansas City Chiefs vs Las Vegas Raiders game on Thanksgiving?";
    for (const total of [86, 98, 110]) expect(fitClamp(t, budget(total))).toMatch(/up to/);
  });
});
