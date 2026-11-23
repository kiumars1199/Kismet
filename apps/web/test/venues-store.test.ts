// F4: the venue block is built from the market's own scan row (Polymarket, Polymarket US: the numbers its card shows) plus
// a Kalshi snapshot no newer than the store's scan. Missing, malformed or stale venues.json = no Kalshi row, never an error.
import { describe, expect, it } from "vitest";
import { buildStore, kalshiSnapshot, loadRaw } from "@/lib/data/store";
import { cardVenue } from "@/lib/card";
import { venueOf } from "@/lib/trade/venue";
import type { VenuesFile, VenuesSnapshot } from "@/lib/types";

const snap = (kalshi_fetched_at: number, price = 0.52, side: 0 | 1 = 0): VenuesSnapshot => ({
  meta: { n: 1, kalshi: true, generated_at: kalshi_fetched_at + 60, kalshi_fetched_at },
  venues: { "6674492": { side, kalshi_ticker: "KXFIXTURE-1", kalshi_match_conf: 0.93, venues: [{ venue: "polymarket", price: 0.01, multiplier: 99, url: "stale" }, { venue: "us", price: 0.01, multiplier: 99, url: "stale" }, { venue: "kalshi", price, multiplier: null, url: "https://kalshi.com/markets/kx" }] } },
});

describe("venues in the store", () => {
  it("Polymarket and US rows are the card's own numbers, whatever venues.json says (6674492, 7078474)", async () => {
    const raw = await loadRaw();
    const s = buildStore({ ...raw, venues: snap(raw.markets.meta.scanned_at) });
    // 6674492: card says "International only, not on Polymarket US" (us null): no US row even though venues.json lists one
    const a = s.byId.get("6674492")!;
    expect(a.us).toBeNull();
    expect(a.venues!.map((v) => v.venue)).toEqual(["polymarket", "kalshi"]);
    expect(a.venues![0]).toMatchObject({ price: a.best.ask, at: raw.markets.meta.scanned_at });
    // 7078474: card prices US at us.ask 0.73 + fee 0.0187 = 1.34x; the block must say the same
    const b = s.byId.get("7078474")!;
    const card = cardVenue(b, b.best);
    expect(card.kind).toBe("us");
    const us = b.venues!.find((v) => v.venue === "us")!;
    expect(us.price).toBe(b.us!.ask);
    expect(us.multiplier).toBeCloseTo(1 / (b.us!.ask! + b.us!.fee!), 3);
    expect(Math.round(us.multiplier! * 100) / 100).toBe(1.34);
    const pm = b.venues!.find((v) => v.venue === "polymarket")!;
    expect(pm.price).toBe(b.best.ask);
  });

  it("Kalshi follows the store's scan: a snapshot fetched after the scan is never shown (Free's delayed store)", async () => {
    const raw = await loadRaw();
    const at = raw.markets.meta.scanned_at;
    const file: VenuesFile = { ...snap(at + 900, 0.9), prev: [snap(at - 600, 0.5)] };   // newest Kalshi crawl is AFTER this store's scan
    const s = buildStore({ ...raw, venues: file });
    expect(s.byId.get("6674492")!.venues!.find((v) => v.venue === "kalshi")!.price).toBe(0.5);   // the older snapshot
    const none = buildStore({ ...raw, venues: { ...snap(at + 900, 0.9) } });
    expect(none.byId.get("6674492")!.venues?.some((v) => v.venue === "kalshi") ?? false).toBe(false);
    expect(kalshiSnapshot(file, at)!.meta.kalshi_fetched_at).toBe(at - 600);
    expect(kalshiSnapshot(file, at + 1000)!.meta.kalshi_fetched_at).toBe(at + 900);
  });

  it("kalshi_unavailable: set when Kalshi's snapshot was filtered by delay or age, not when Kalshi never listed it", async () => {
    const raw = await loadRaw();
    const at = raw.markets.meta.scanned_at;
    // 7078474 is on Polymarket + Polymarket US (best side 1), so its block shows whatever Kalshi says
    const sn = (t: number, side: 0 | 1 = 1): VenuesSnapshot => ({ meta: { n: 1, kalshi: true, generated_at: t + 60, kalshi_fetched_at: t }, venues: { "7078474": { side, kalshi_ticker: "KXFIXTURE-2", venues: [{ venue: "kalshi", price: 0.5, multiplier: 1.9, url: "https://kalshi.com/markets/kx" }] } } });
    const id = "7078474";
    const delayed = buildStore({ ...raw, venues: sn(at + 900) });   // crawl newer than this (delayed) store's scan
    expect(delayed.byId.get(id)!.kalshi_unavailable).toBe(true);
    expect(delayed.byId.get(id)!.venues!.map((v) => v.venue)).toEqual(["polymarket", "us"]);
    expect(buildStore({ ...raw, venues: sn(at - 4 * 3600) }).byId.get(id)!.kalshi_unavailable).toBe(true);   // over 3 h old
    expect(buildStore({ ...raw, venues: sn(at - 60) }).byId.get(id)!.kalshi_unavailable).toBeUndefined();   // shown
    expect(buildStore({ ...raw, venues: sn(at - 60, 0) }).byId.get(id)!.kalshi_unavailable).toBeUndefined();   // other side: not listed
    expect(buildStore({ ...raw, venues: undefined }).byId.get(id)!.kalshi_unavailable).toBeUndefined();   // no file: not listed
  });

  it("the Kalshi multiplier from venues.json is kept (not nulled by the store)", async () => {
    const raw = await loadRaw();
    const s = buildStore({ ...raw, venues: { ...snap(raw.markets.meta.scanned_at - 60, 0.52), venues: { "6674492": { ...snap(1).venues["6674492"]!, venues: [{ venue: "kalshi", price: 0.52, multiplier: 1.85, url: "https://kalshi.com/markets/kx" }] } } } });
    expect(s.byId.get("6674492")!.venues!.find((v) => v.venue === "kalshi")!.multiplier).toBe(1.85);
  });

  it("a Kalshi quote for the other side of the market is dropped; stale (over 3 h) and malformed files give no Kalshi row", async () => {
    const raw = await loadRaw();
    const at = raw.markets.meta.scanned_at;
    const other = buildStore({ ...raw, venues: snap(at - 60, 0.5, 1) });
    expect(other.byId.get("6674492")!.venues?.some((v) => v.venue === "kalshi") ?? false).toBe(false);
    expect(kalshiSnapshot(snap(at - 4 * 3600), at)).toBeUndefined();
    expect(kalshiSnapshot(undefined, at)).toBeUndefined();
    expect(kalshiSnapshot({ meta: snap(1).meta } as unknown as VenuesFile, at)).toBeUndefined();
    expect(buildStore({ ...raw, venues: undefined }).byId.get("7078474")!.venues!.map((v) => v.venue)).toEqual(["polymarket", "us"]);
  });

  it("a market on one venue has no block data; US-native rows never get one", async () => {
    const raw = await loadRaw();
    const s = buildStore({ ...raw, venues: snap(raw.markets.meta.scanned_at) });
    expect(s.byId.get("6635049")!.us).toBeNull();
    expect(s.byId.get("6635049")!.venues).toBeUndefined();   // international only, no Kalshi match: one venue
    expect(s.markets.filter((m) => m.venue === "us").every((m) => !m.venues)).toBe(true);
  });

  it("a market with a Kalshi match exposes the matched ticker for link lookups, WITHOUT making Kalshi its bet venue", async () => {
    const raw = await loadRaw();
    const s = buildStore({ ...raw, venues: snap(raw.markets.meta.scanned_at) });
    const m = s.byId.get("6674492")!;
    expect(m.kalshi_matched_ticker).toBe("KXFIXTURE-1");
    expect(m.kalshi_match_conf).toBe(0.93);
    expect(m.kalshi_ticker ?? null).toBeNull();   // kalshi_ticker = "this market is bet on Kalshi" (venueOf, Trade, combos, MCP)
    expect(venueOf(m).name).toBe("Polymarket");
    expect(s.flagsById.get("6674492")!.kalshi_matched_ticker).toBe("KXFIXTURE-1");
    // no Kalshi row for this scan (snapshot newer than the scan) = no matched ticker either
    const at = raw.markets.meta.scanned_at;
    expect(buildStore({ ...raw, venues: snap(at + 900) }).byId.get("6674492")!.kalshi_matched_ticker).toBeUndefined();
    // the venues.json fixture carries one for each Kalshi-matched market
    expect(buildStore(raw).byId.get("7077573")!.kalshi_matched_ticker).toBeTruthy();
  });

  it("flags carry the same venues as their market", async () => {
    const raw = await loadRaw();
    const s = buildStore({ ...raw, venues: snap(raw.markets.meta.scanned_at) });
    expect(s.flagsById.get("6674492")!.venues).toEqual(s.byId.get("6674492")!.venues);
  });
});
