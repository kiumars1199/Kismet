import { describe, expect, it } from "vitest";
import { deepLink, GUIDES, VENUE_IDS, venueLinks } from "./guides";
import type { StoreMarket } from "@/lib/types";

const m = (o: Record<string, unknown>) => ({ url: "https://polymarket.com/event/game-1", ...o }) as unknown as Parameters<typeof deepLink>[0];
const us = { slug: "aec-1", url: "https://polymarket.us/event/aec-1", side: 0, ask: 0.5, fee: 0, edge: 0, roi_pct: 0 };

describe("guides", () => {
  it("every venue has exactly 3 non-empty steps, a name and sources with https URLs", () => {
    expect(VENUE_IDS.sort()).toEqual(["kalshi", "polymarket", "polymarket-us"]);
    for (const id of VENUE_IDS) {
      expect(GUIDES[id].steps).toHaveLength(3);
      for (const s of GUIDES[id].steps) expect(s.text.length).toBeGreaterThan(10);
      expect(GUIDES[id].name.length).toBeGreaterThan(2);
    }
  });
  it("every step names the page it came from: an https URL and the day it was checked", () => {
    for (const id of VENUE_IDS) for (const s of GUIDES[id].steps) {
      expect(s.source.url, s.text).toMatch(/^https:\/\/[^\s]+$/);
      expect(s.source.checked, s.text).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (s.source.printed) expect(s.source.printed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("no cents in the steps", () => { for (const id of VENUE_IDS) expect(GUIDES[id].steps.map((x) => x.text).join(" ")).not.toMatch(/\d¢|cents? /i); });
});

describe("deepLink", () => {
  it("polymarket: the market's own url", () => expect(deepLink(m({}), "polymarket")).toBe("https://polymarket.com/event/game-1"));
  it("polymarket: none for a US-only market", () => expect(deepLink(m({ venue: "us", url: "https://polymarket.us/event/x" }), "polymarket")).toBeNull());
  it("polymarket-us: the US twin's url", () => expect(deepLink(m({ us }), "polymarket-us")).toBe("https://polymarket.us/event/aec-1"));
  it("polymarket-us: a US-only market's own url", () => expect(deepLink(m({ venue: "us", url: "https://polymarket.us/event/x" }), "polymarket-us")).toBe("https://polymarket.us/event/x"));
  it("polymarket-us: none when not listed", () => expect(deepLink(m({ us: null }), "polymarket-us")).toBeNull());
  it("kalshi: the venues quote's url, never a guess from the ticker", () => {
    expect(deepLink(m({ venues: [{ venue: "kalshi", url: "https://kalshi.com/markets/kxnfl/x" }] }), "kalshi")).toBe("https://kalshi.com/markets/kxnfl/x");
    expect(deepLink(m({ kalshi_ticker: "KXNFL-1" }), "kalshi")).toBeNull();
  });
  it("a venues url overrides the market's own for that venue, and non-https is dropped", () => {
    expect(deepLink(m({ venues: [{ venue: "polymarket", url: "https://polymarket.com/event/other" }] }), "polymarket")).toBe("https://polymarket.com/event/other");
    expect(deepLink(m({ venues: [{ venue: "kalshi", url: "javascript:alert(1)" }] }), "kalshi")).toBeNull();
  });
});

describe("venueLinks", () => {
  it("lists the venues a market is on", () => {
    expect(venueLinks(m({})).map((v) => v.venue)).toEqual(["polymarket"]);
    expect(venueLinks(m({ us })).map((v) => v.venue)).toEqual(["polymarket", "polymarket-us"]);
    expect(venueLinks(m({ venue: "us" })).map((v) => v.venue)).toEqual(["polymarket-us"]);
    expect(venueLinks(m({ us, venues: [{ venue: "kalshi", url: "https://kalshi.com/markets/a" }] })).map((v) => v.venue)).toEqual(["polymarket", "polymarket-us", "kalshi"]);
  });
  it("fixture markets get a polymarket link and, with a US twin, a US link", async () => {
    const fx = ((await import("../../test/fixtures/markets.json")).default as unknown as { markets: StoreMarket[] }).markets;
    const twin = fx.find((x) => x.us);
    expect(venueLinks(twin!).map((v) => v.venue)).toContain("polymarket-us");
    expect(venueLinks(fx[0]!)[0]!.url).toMatch(/^https:\/\/polymarket\.com\//);
  });
});

import { availabilityNote, defaultVenue } from "./guides";
describe("venue availability in the guide (F9 adapter)", () => {
  const links = [{ venue: "polymarket" as const, url: "https://polymarket.com/e/x" }, { venue: "kalshi" as const, url: null }];
  it("nothing known available: no default venue", () => expect(defaultVenue(links, () => "unverified")).toBeNull());
  it("restricted is never the default", () => expect(defaultVenue(links, () => "restricted")).toBeNull());
  it("the first venue known available is the default", () => expect(defaultVenue(links, (v) => (v === "kalshi" ? "available" : "unverified"))).toBe("kalshi"));
  it("note text", () => {
    expect(availabilityNote("kalshi", "unverified", null)).toBe("Check Kalshi for your state");
    expect(availabilityNote("kalshi", "unverified", "Texas")).toBe("Check Kalshi for Texas");
    expect(availabilityNote("kalshi", "available", "Texas")).toBe("Kalshi: available in Texas");
    expect(availabilityNote("polymarket-us", "restricted", "Texas")).toBe("Polymarket US: not available in Texas");
  });
});
