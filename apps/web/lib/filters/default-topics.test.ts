import { describe, expect, it } from "vitest";
import { defaultTopicsHref, parseTopicsCookie, topicsCookieValue } from "./default-topics";

describe("defaultTopicsHref", () => {
  it("opens with the user's topics when the URL has no filters", () => {
    expect(defaultTopicsHref("", ["sports.nfl"], false)).toBe("?fav=1&t=sports.nfl");
    expect(defaultTopicsHref("", ["sports.nfl", "politics.elections"], false)).toBe("?fav=1&t=sports.nfl%2Cpolitics.elections");
  });
  it("does nothing without topics (skipped setup)", () => {
    expect(defaultTopicsHref("", [], false)).toBeNull();
  });
  it("does nothing after the user cleared the pill", () => {
    expect(defaultTopicsHref("", ["sports.nfl"], true)).toBeNull();
  });
  it("leaves an explicit filter alone; a drawer-only or soft-navigation URL still opens filtered", () => {
    expect(defaultTopicsHref("?topics=weather", ["sports.nfl"], false)).toBeNull();
    expect(defaultTopicsHref("?view=flags&t=weather", ["sports.nfl"], false)).toBeNull();
    expect(defaultTopicsHref("?m=abc&side=0", ["sports.nfl"], false)).toBe("?fav=1&t=sports.nfl&m=abc&side=0");
    expect(defaultTopicsHref("?_rsc=1x2y3", ["sports.nfl"], false)).toBe("?fav=1&t=sports.nfl");
  });
});

describe("topics cookie", () => {
  it("round-trips topics and the cleared flag", () => {
    expect(parseTopicsCookie(topicsCookieValue(["sports.nfl", "weather"], false))).toEqual({ favorites: ["sports.nfl", "weather"], dismissed: false });
    expect(parseTopicsCookie(topicsCookieValue(["sports.nfl"], true))).toEqual({ favorites: ["sports.nfl"], dismissed: true });
    expect(parseTopicsCookie(topicsCookieValue([], false))).toEqual({ favorites: [], dismissed: false });
  });
  it("ignores a missing, malformed or tampered value", () => {
    for (const v of [undefined, null, "", "garbage", "on"]) expect(parseTopicsCookie(v)).toEqual({ favorites: [], dismissed: false });
    expect(parseTopicsCookie("on:sports.nfl,<script>,../x,weather").favorites).toEqual(["sports.nfl", "weather"]);
  });
});
