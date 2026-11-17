import { describe, expect, it } from "vitest";
import fixture from "@/test/fixtures/backtest.json";
import { bucketRows, foldRows, tiles } from "./trackRecord";
import type { BacktestFile } from "./types";

const b = fixture as unknown as BacktestFile;
const chosen = b.results[String(b.chosen_half_life_days ?? "None")];

describe("track record tiles", () => {
  it("equal the chosen half-life's taker record in backtest.json", () => {
    const t = Object.fromEntries(tiles(b).map((x) => [x.key, x]));
    const s = chosen.taker;
    expect(t.bets.value).toBe(s.flags);
    expect(t.ret.value).toBe(s.roi_pct);
    expect(t.cents.value).toBe(s.pnl_cents_per_share);
    expect(t.t.value).toBe(s.t_stat);
    expect(t.events.value).toBe(s.events);
    expect([t.bets.text, t.ret.text, t.cents.text, t.t.text, t.events.text]).toEqual(["9,666", "+9.5%", "+7.4¢", "18.5", "1,394"]);
    expect([t.bets.baseline, t.ret.baseline, t.cents.baseline]).toEqual(["394,440", "−21%", "−13.4¢"]);
  });

  it("keeps empty weeks and losses visible", () => {
    const f = foldRows(b);
    expect(f).toHaveLength((chosen.folds as unknown[]).length);
    expect(f[0]).toMatchObject({ bets: 0, ret: null, retText: "no bets" });
    expect(f.some((x) => x.ret !== null && x.ret < 0)).toBe(true);
  });

  it("buckets show predicted and realized cents", () => {
    expect(bucketRows(b)[0]).toEqual({ bucket: "2–5¢", bets: 1955, predicted: 3.41, realized: 2.72 });
    expect(bucketRows(b).at(-1)?.bucket).toBe("15¢+");
  });
});
