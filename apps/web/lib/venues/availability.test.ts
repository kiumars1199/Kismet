// F9: config/venue-availability.json is complete and sourced; the wording never claims more than the entry says.
import { describe, expect, it } from "vitest";
import { AVAILABILITY, VENUE_KEYS, statusesFor } from "./availability";
import { availabilityLine } from "./availability-text";
import { US_STATES, validState } from "./states";

describe("venue-availability.json", () => {
  it("covers kalshi, polymarket_us and polymarket_intl", () => {
    expect([...VENUE_KEYS].sort()).toEqual(["kalshi", "polymarket_intl", "polymarket_us"]);
  });
  it("has every state and DC for each venue, matching the states list", () => {
    expect(Object.keys(US_STATES)).toHaveLength(51);
    expect(AVAILABILITY.states).toEqual(US_STATES);
    for (const k of VENUE_KEYS) expect(Object.keys(AVAILABILITY.venues[k].entries).sort(), k).toEqual(Object.keys(US_STATES).sort());
  });
  it("fails if any entry lacks a source URL or a checked date", () => {
    for (const k of VENUE_KEYS)
      for (const [st, e] of Object.entries(AVAILABILITY.venues[k].entries)) {
        expect(e.source_url, `${k} ${st} source_url`).toMatch(/^https:\/\/[^\s]+$/);
        expect(e.checked, `${k} ${st} checked`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(e.checked)), `${k} ${st} date`).toBe(false);
        expect(["available", "restricted", "unverified"], `${k} ${st} status`).toContain(e.status);
        expect(e.note.length, `${k} ${st} note`).toBeGreaterThan(10);
      }
  });
  it("only marks available or restricted with an official source host", () => {
    const official = /^https:\/\/(help\.kalshi\.com|kalshi\.com|docs\.polymarket\.us|polymarket\.us|help\.polymarket\.com|[a-z.]+\.gov)\//;
    for (const k of VENUE_KEYS)
      for (const [st, e] of Object.entries(AVAILABILITY.venues[k].entries)) if (e.status !== "unverified") expect(e.source_url, `${k} ${st}`).toMatch(official);
  });
  it("international Polymarket is restricted in every state (its Geographic Restrictions page blocks the US)", () => {
    expect(Object.values(AVAILABILITY.venues.polymarket_intl.entries).every((e) => e.status === "restricted")).toBe(true);
  });
});

describe("wording", () => {
  it("says available, not available, check the venue, or check your state", () => {
    expect(availabilityLine("kalshi", "Texas", "available")).toBe("Kalshi: available in Texas");
    expect(availabilityLine("polymarket_intl", "Nevada", "restricted")).toBe("Polymarket: not available in Nevada");
    expect(availabilityLine("polymarket_us", "Ohio", "unverified")).toBe("Check Polymarket US for Ohio");
    expect(availabilityLine("kalshi", null, null)).toBe("Check your state");
  });
  it("statusesFor knows a state and nothing else", () => {
    expect(statusesFor("NV")).toEqual({ kalshi: "unverified", polymarket_us: "unverified", polymarket_intl: "restricted" });
    expect(statusesFor(null)).toBeNull();
    expect(statusesFor("ZZ")).toBeNull();
  });
  it("validState accepts codes in any case and rejects the rest", () => {
    expect(validState("tx")).toBe("TX");
    for (const v of ["", "ZZ", "Texas", 5, null, "__proto__"]) expect(validState(v)).toBeNull();
  });
});
