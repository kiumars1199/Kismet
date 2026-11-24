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
    const out = fitClamp(t, budget(76));
    expect(out).toContain("Los Angeles");
    expect(out).toContain("66-67°F");
    expect(out.endsWith("November 18?")).toBe(true);
    expect((LEDE + out).length).toBeLessThanOrEqual(76);
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
