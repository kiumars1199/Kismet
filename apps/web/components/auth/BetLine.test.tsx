// @vitest-environment jsdom
// T-wt1e: the bet line's fit must leave the line showing the ANSWER of the search, not its last probe: a re-measure that finds the same answer
// (state unchanged, so React doesn't re-render) used to leave the DOM on whatever candidate the binary search tried last, which on CI was a
// text that wrapped to a third line. jsdom has no layout, so a fake box says "fits" when the text is at most 60 characters.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { BetLine, BET_LEDE } from "./BetLine";

const LIMIT = 60;   // characters of lede + title the fake box holds in two lines
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 33 });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return (this.textContent ?? "").length <= LIMIT ? 33 : 50; } });
});
afterEach(cleanup);

const TITLES = [
  "Will the highest temperature in San Francisco be between 60-61°F on November 17?",
  "Will Max Verstappen finish on the podium at the 2026 F1 Las Vegas Grand Prix?",
  "Will Donald Trump post 80-99 Truth Social posts from November 13 to November 20, 2026?",
  "Exact Score: Real Madrid CF 2 - 0 RC Celta de Vigo?",
];

describe("BetLine", () => {
  for (const title of TITLES) {
    it(`"${title.slice(0, 30)}…": the visible text fits, and stays the same after any number of idle re-measures`, () => {
      const { getByTestId } = render(<BetLine title={title} />);
      const p = getByTestId("signup-bet");
      const first = p.textContent!;
      expect(first.startsWith(BET_LEDE)).toBe(true);
      expect(first.length, "fits the box").toBeLessThanOrEqual(LIMIT);
      for (let i = 0; i < 4; i++) {
        act(() => { window.dispatchEvent(new Event("load")); });
        expect(p.textContent, `after ${i + 1} idle re-measures`).toBe(first);
        expect(p.textContent!.length).toBeLessThanOrEqual(LIMIT);
      }
    });
  }
  it("a title that fits is shown whole", () => {
    const { getByTestId } = render(<BetLine title="Denmark vs. Norway" />);
    expect(getByTestId("signup-bet").textContent).toBe(BET_LEDE + "Denmark vs. Norway");
  });
});
