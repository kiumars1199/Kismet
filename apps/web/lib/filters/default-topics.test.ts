import { describe, expect, it } from "vitest";
import { TOPICS_COOKIE_MAX_AGE, defaultTopicsHref, parseTopicsCookie, topicsCookieValue } from "./default-topics";

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
  it("round-trips topics and the cleared flag for the same user", () => {
    expect(parseTopicsCookie(topicsCookieValue("u1", ["sports.nfl", "weather"], false), "u1")).toEqual({ favorites: ["sports.nfl", "weather"], dismissed: false });
    expect(parseTopicsCookie(topicsCookieValue("u1", ["sports.nfl"], true), "u1")).toEqual({ favorites: ["sports.nfl"], dismissed: true });
    expect(parseTopicsCookie(topicsCookieValue("u1", [], false), "u1")).toEqual({ favorites: [], dismissed: false });
  });
  it("ignores a cookie written for another user (shared browser) or with no user", () => {
    const v = topicsCookieValue("u1", ["sports.nfl"], false);
    expect(parseTopicsCookie(v, "u2")).toEqual({ favorites: [], dismissed: false });
    expect(parseTopicsCookie(v, undefined)).toEqual({ favorites: [], dismissed: false });
    expect(parseTopicsCookie("on:sports.nfl", "u1")).toEqual({ favorites: [], dismissed: false });   // old unbound format
  });
  it("lives long enough that a returning user's first visit the next day already opens filtered", () => {
    expect(TOPICS_COOKIE_MAX_AGE).toBeGreaterThanOrEqual(30 * 24 * 3600);
  });
  it("ignores a missing, malformed or tampered value", () => {
    for (const v of [undefined, null, "", "garbage", "on", "u1|on"]) expect(parseTopicsCookie(v, "u1")).toEqual({ favorites: [], dismissed: false });
    expect(parseTopicsCookie("u1|on:sports.nfl,<script>,../x,weather", "u1").favorites).toEqual(["sports.nfl", "weather"]);
  });
});
