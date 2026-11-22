import { describe, expect, it } from "vitest";
import { defaultTopicsHref } from "./default-topics";

describe("defaultTopicsHref", () => {
  it("opens with the user's topics when the URL has no filters", () => {
    expect(defaultTopicsHref("", ["sports.nfl"], false)).toBe("?fav=1");
  });
  it("does nothing without topics (skipped setup)", () => {
    expect(defaultTopicsHref("", [], false)).toBeNull();
  });
  it("does nothing after the user cleared the pill", () => {
    expect(defaultTopicsHref("", ["sports.nfl"], true)).toBeNull();
  });
  it("leaves an explicit filter or a drawer-only URL alone", () => {
    expect(defaultTopicsHref("?topics=weather", ["sports.nfl"], false)).toBeNull();
    expect(defaultTopicsHref("?view=flags&topics=weather", ["sports.nfl"], false)).toBeNull();
    expect(defaultTopicsHref("?m=abc&side=0", ["sports.nfl"], false)).toBe("?fav=1&m=abc&side=0");
  });
});
