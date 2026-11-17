// T-72: MiniSearch index, q → filters, relevance ranking, honest fallback, pays filter/sort on the fixture.
import { describe, expect, it } from "vitest";
import { marketsPage } from "@/lib/data/respond";
import { getStore } from "@/lib/data/store";
import { apply, paysOf } from "@/lib/filters/apply";
import { FilterState, type FilterInput } from "@/lib/filters/state";

const st = (p: FilterInput) => FilterState.parse({ group_by_event: false, page_size: 200, ...p });

describe("search on the fixture", async () => {
  const store = await getStore();
  const text = (r: { market: { question: string; event: string } }) => `${r.market.question} ${r.market.event}`;

  it("typo pass: barcelna → FC Barcelona markets; exact words never fuzz (texans ≠ texas)", () => {
    expect(store.search.find("barcelna")!.has("6673454")).toBe(true);
    expect(store.search.find("bar")!.has("6673454")).toBe(true);
    const texans = [...store.search.find("texans")!.keys()].map((id) => store.byId.get(id)!);
    expect(texans.every((m) => /texans/i.test(m.question + m.event + m.sides.map((s) => s.outcome).join()))).toBe(true);
  });

  it("entities: 'bar' suggests FC Barcelona (and other Barcelona clubs) on the 3rd letter", () => {
    const names = store.search.entities("bar", 5).map((e) => e.name);
    expect(names).toContain("FC Barcelona");
    expect(store.search.entities("lond", 3).map((e) => e.name)).toContain("London");
  });

  it("q merges filters: nyc weather → New York weather only", () => {
    const p = apply(store, st({ q: "nyc weather" }));
    expect(p.total).toBeGreaterThan(0);
    expect(p.rows.every((r) => r.market.category === "weather" && /new york|nyc/i.test(text(r)))).toBe(true);
    expect(p.search!.chips.map((c) => c.label)).toEqual(["City: New York", "Weather & Climate"]);
  });

  it("over 2.5 goals → soccer O/U 2.5 markets", () => {
    const p = apply(store, st({ q: "over 2.5 goals" }));
    expect(p.total).toBeGreaterThan(0);
    expect(p.rows.every((r) => r.market.niche === "soccer" && /2\.5/.test(r.market.question))).toBe(true);
  });

  it("safe bets → every row has a 80%+ chance", () => {
    const p = apply(store, st({ q: "safe bets" }));
    expect(p.total).toBeGreaterThan(0);
    expect(p.rows.every((r) => r.side.win_prob >= 0.8)).toBe(true);
  });

  it("relevance: with text and the default sort, the best text match comes first", () => {
    const p = apply(store, st({ q: "barcelona", win_prob_min: 0 }));
    expect(p.rows.every((r) => /barcelona/i.test(text(r) + r.market.sides.map((s) => s.outcome).join()))).toBe(true);
    expect(/barcelona/i.test(p.rows[0]!.market.question)).toBe(true);
  });

  it("honest fallback: barcelona 3x good edge relaxes and says so; rows are Barcelona, never passed off as 3x", () => {
    const r = marketsPage(store, st({ q: "barcelona 3x good edge" }));
    expect(r.total).toBeGreaterThan(0);
    expect(r.search!.relaxed).toMatch(/^No bets match all of Barcelona · Pays ~3x · Return 10%\+ right now\. Showing /);
    expect(r.rows.every((x) => /barcelona/i.test(text(x)))).toBe(true);
    expect("parsed" in r).toBe(false);
    // an exact hit carries no note
    expect(marketsPage(store, st({ q: "barcelona" })).search!.relaxed).toBeUndefined();
  });

  it("pays filter lifts the long-shot floor; Biggest payout sorts by 1/ask with edge ≥ 2¢", () => {
    const p = apply(store, st({ pays_min: 3 }));
    expect(p.total).toBeGreaterThan(0);
    expect(p.rows.every((r) => paysOf(r.side)! >= 3)).toBe(true);
    expect(p.rows.some((r) => r.side.win_prob < 0.4)).toBe(true);
    const s = apply(store, st({ sort: { key: "pays", dir: "desc" } }));
    expect(s.rows.every((r) => r.side.edge >= 0.02)).toBe(true);
    for (let i = 1; i < s.rows.length; i++) expect(paysOf(s.rows[i - 1]!.side)!).toBeGreaterThanOrEqual(paysOf(s.rows[i]!.side)!);
  });

  it("search + filter stays fast on the fixture (< 50 ms)", () => {
    const t = performance.now();
    for (const q of ["barcelona 3x good edge", "nyc weather", "bar", "over 2.5 goals"]) marketsPage(store, st({ q }));
    expect((performance.now() - t) / 4).toBeLessThan(50);
  });
});
