import { describe, expect, it } from "vitest";
import { parseLink, resolveLink } from "./parse-link";
import type { StoreMarket } from "@/lib/types";

const mk = (o: Partial<StoreMarket> & { id: string; slug: string }) => ({ venue: undefined, ...o }) as unknown as StoreMarket;
const markets = [
  mk({ id: "101", slug: "nfl-ind-hou-2026-11-20", market_slug: "nfl-ind-hou-2026-11-20-moneyline", us: { slug: "aec-nfl-101", url: "", side: 0, ask: 0.5, fee: 0.01, edge: 0, roi_pct: 0 }, kalshi_ticker: "KXNFLGAME-26NOV20INDHOU-HOU" }),
  mk({ id: "102", slug: "nfl-ind-hou-2026-11-20", market_slug: "nfl-ind-hou-2026-11-20-spread" }),
  mk({ id: "us-7", slug: "aec-nba-7", market_slug: "aec-nba-7-lal", venue: "us" }),
];
const store = { markets, bySlug: new Map([["nfl-ind-hou-2026-11-20", [markets[0]!, markets[1]!]], ["aec-nba-7", [markets[2]!]]]) };
const id = (u: string) => { const p = parseLink(u); return p ? resolveLink(p, store)?.id ?? null : null; };

describe("parseLink", () => {
  it("polymarket.com event link", () => expect(parseLink("https://polymarket.com/event/nfl-ind-hou-2026-11-20")).toEqual({ venue: "polymarket", parts: ["nfl-ind-hou-2026-11-20"] }));
  it("polymarket.com event + market slug, www and query string", () =>
    expect(parseLink("https://www.polymarket.com/event/a/b?tid=1")).toEqual({ venue: "polymarket", parts: ["a", "b"] }));
  it("polymarket.us event and market links", () => {
    expect(parseLink("https://polymarket.us/event/aec-nfl-101")?.venue).toBe("polymarket-us");
    expect(parseLink("polymarket.us/market/aec-nfl-101")?.parts).toEqual(["aec-nfl-101"]);
  });
  it("kalshi.com market link, with and without ticker segment", () => {
    expect(parseLink("https://kalshi.com/markets/kxnflgame")).toEqual({ venue: "kalshi", parts: ["kxnflgame"] });
    expect(parseLink("https://kalshi.com/markets/kxnflgame/nfl-game/kxnflgame-26nov20indhou")?.parts).toHaveLength(3);
  });
  it("rejects other hosts, other paths, junk and non-http", () => {
    expect(parseLink("https://example.com/event/x")).toBeNull();
    expect(parseLink("https://polymarket.com/profile/x")).toBeNull();
    expect(parseLink("https://polymarket.com/event/")).toBeNull();
    expect(parseLink("lakers vs celtics")).toBeNull();
    expect(parseLink("")).toBeNull();
    expect(parseLink("javascript:alert(1)")).toBeNull();
    expect(parseLink("https://evilpolymarket.com/event/x")).toBeNull();
  });
});

describe("resolveLink: the market id the card uses", () => {
  it("polymarket.com market slug → that market; event slug alone → first market of the event", () => {
    expect(id("https://polymarket.com/event/nfl-ind-hou-2026-11-20/nfl-ind-hou-2026-11-20-spread")).toBe("102");
    expect(id("https://polymarket.com/event/nfl-ind-hou-2026-11-20")).toBe("101");
  });
  it("polymarket.us twin slug → the international market's id; a US-only market → its us- id", () => {
    expect(id("https://polymarket.us/event/aec-nfl-101")).toBe("101");
    expect(id("https://polymarket.us/event/aec-nba-7")).toBe("us-7");
    expect(id("https://polymarket.us/market/aec-nba-7-lal")).toBe("us-7");
  });
  it("kalshi ticker (any case) → the matched market", () => {
    expect(id("https://kalshi.com/markets/kxnflgame/nfl-game/kxnflgame-26nov20indhou-hou")).toBe("101");
  });
  it("unknown links resolve to null", () => {
    expect(id("https://polymarket.com/event/nope")).toBeNull();
    expect(id("https://kalshi.com/markets/zzz")).toBeNull();
    expect(id("https://polymarket.us/event/nope")).toBeNull();
  });
});
