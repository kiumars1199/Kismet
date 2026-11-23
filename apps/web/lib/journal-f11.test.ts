// F11: settlement of fixture bets matches hand math (fees included), "Beat the closing price", and P&L splits that add up.
import { describe, expect, it, vi } from "vitest";
import { feePerShare } from "@/lib/calc";
import { beatClose, breakdown, pnl, settlePatch, summarize, type Settlement } from "@/lib/journal";
import { settleJournal } from "@/lib/settle";
import type { JournalEntry } from "@/lib/repo/types";
import { fakeSupabase } from "../test/fakeSupabase";

const bet = (o: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "j", market_id: "m", side_index: 0, outcome: "Yes", question: "Q?", category: "sports", niche: "nfl",
  price: 0.6, shares: 10, fee: 0, placed_at: "2026-11-16T03:30:00.000Z", model_win_prob: 0.7, model_edge: 0.1,
  closing_price: null, result: null, settled_at: null, pnl_usd: null, tags: [], note: null, ...o,
});
const won0: Settlement = { resolved: true, winner_side_index: 0, closing_prices: [0.7, 0.3] };
const now = new Date("2026-11-17T00:00:00Z");

describe("F11 settlement hand math", () => {
  // fee per share from lib/calc (the 0.03 rate is only a test input; the real rate lives in lib/execution)
  const fee = feePerShare(0.6, 0.03);   // 0.03 * 0.6 * 0.4 = 0.0072

  it("1 win, no fee: 10 shares at 60% pays $10, costs $6, profit $4", () => {
    expect(settlePatch(bet(), won0, now)).toMatchObject({ result: "won", pnl_usd: 4 });
  });
  it("2 win with fee: 10 x (1 - 0.6 - 0.0072) = $3.928", () => {
    expect(fee).toBeCloseTo(0.0072, 12);
    expect(settlePatch(bet({ fee }), won0, now)!.pnl_usd).toBeCloseTo(3.928, 10);
  });
  it("3 loss with fee loses stake plus fee: -10 x 0.6072", () => {
    const p = settlePatch(bet({ fee, side_index: 1 }), won0, now)!;
    expect(p.result).toBe("lost");
    expect(p.pnl_usd).toBeCloseTo(-6.072, 10);
  });
  it("4 a Polymarket 50/50 market pays $0.50 a share: P&L = 0.5 x shares - cost, fees included", () => {
    // 10 x 0.5 - 10 x (0.6 + 0.0072) = 5 - 6.072 = -1.072 ; at 40% it is a gain: 5 - 4 = +1
    const p = settlePatch(bet({ fee }), { resolved: true, winner_side_index: null, closing_prices: [0.5, 0.5] }, now)!;
    expect(p.result).toBe("split");
    expect(p.pnl_usd).toBeCloseTo(-1.072, 10);
    expect(settlePatch(bet({ price: 0.4 }), { resolved: true, winner_side_index: null, closing_prices: [null, null] }, now)!.pnl_usd).toBeCloseTo(1, 10);
  });
  it("4b a void bet (Kalshi or edited by hand) gets the stake back: P&L 0", () => {
    expect(pnl(bet({ fee }), "void")).toBe(0);
  });
  it("5 an unresolved market with no closing price leaves the bet untouched", () => {
    expect(settlePatch(bet(), { resolved: false, winner_side_index: null, closing_prices: [null, null] }, now)).toBeNull();
  });
  it("6 a settled bet is never re-graded", () => {
    const p = settlePatch(bet({ result: "lost", pnl_usd: -6, closing_price: 0.7 }), won0, now);
    expect(p).toBeNull();   // result and P&L stay; nothing else changed
    expect(settlePatch(bet({ result: "lost", pnl_usd: -6 }), won0, now)).toEqual({ closing_price: 0.7 });   // only the close is filled in
  });
  it("7 the second side wins when side 1 wins, with its own closing price", () => {
    const p = settlePatch(bet({ side_index: 1, price: 0.25 }), { resolved: true, winner_side_index: 1, closing_prices: [0.7, 0.3] }, now)!;
    expect(p).toMatchObject({ result: "won", closing_price: 0.3 });
    expect(p.pnl_usd).toBeCloseTo(7.5, 10);
  });
  it("8 the job grades fixture bets for two users and a second run changes nothing", async () => {
    const d = fakeSupabase({ journal: [
      { ...bet({ id: "a", fee }), user_id: "u1" },
      { ...bet({ id: "b", side_index: 1, fee }), user_id: "u2" },
    ] });
    const settle = vi.fn(async () => won0);
    expect(await settleJournal(d as never, now, settle)).toMatchObject({ updated: 2, failed: 0 });
    const [a, b] = d.tables.journal!;
    expect(a).toMatchObject({ result: "won" });
    expect(Number(a!.pnl_usd)).toBeCloseTo(3.928, 10);
    expect(b).toMatchObject({ result: "lost" });
    expect(Number(b!.pnl_usd)).toBeCloseTo(-6.072, 10);
    expect((await settleJournal(d as never, now, settle)).updated).toBe(0);
  });
});

describe("F11 Beat the closing price", () => {
  it("is true when you paid less than the closing price, false when equal or more, null when unknown", () => {
    expect(beatClose(bet({ price: 0.6, closing_price: 0.65 }))).toBe(true);
    expect(beatClose(bet({ price: 0.6, closing_price: 0.6 }))).toBe(false);
    expect(beatClose(bet({ price: 0.6, closing_price: 0.55 }))).toBe(false);
    expect(beatClose(bet({ closing_price: null }))).toBeNull();
  });
});

describe("F11 P&L by sport and topic adds up to the total", () => {
  const rows = [
    bet({ id: "1", category: "sports", niche: "nfl", result: "won", pnl_usd: pnl(bet(), "won") }),
    bet({ id: "2", category: "sports", niche: "nba", result: "lost", pnl_usd: pnl(bet(), "lost") }),
    bet({ id: "3", category: "politics", niche: null, result: "won", pnl_usd: 12.34 }),
    bet({ id: "4", category: null, niche: null, result: "lost", pnl_usd: -1.5 }),
    bet({ id: "5", category: "sports", niche: "nfl", result: "void", pnl_usd: 0 }),
    bet({ id: "6", category: "sports", niche: "nfl" }),   // open: not counted
  ];
  it("by sport (category) and by topic (niche, else category) each sum to the summary total", () => {
    const total = summarize(rows).pnl;
    expect(breakdown(rows, "category").reduce((a, t) => a + t.pnl, 0)).toBeCloseTo(total, 10);
    expect(breakdown(rows, "topic").reduce((a, t) => a + t.pnl, 0)).toBeCloseTo(total, 10);
    expect(breakdown(rows, "category").map((t) => t.key).sort()).toEqual(["other", "politics", "sports"]);
  });
  it("counts settled bets per group and ranks best first", () => {
    const t = breakdown(rows, "topic");
    expect(t[0]).toMatchObject({ key: "politics", bets: 1 });
    expect(t.find((x) => x.key === "nfl")).toMatchObject({ bets: 2 });
  });
  it("a settled row missing pnl_usd is valued by hand math, the same way the total does", () => {
    const r = [bet({ result: "won", pnl_usd: null })];
    expect(breakdown(r, "category")[0]!.pnl).toBeCloseTo(summarize(r).pnl, 12);
  });
});
