// docs/18 §2–3 against the fixtures: two tiers, Pays searches both, the 10x / 14% example lands in tier "edge".
import { describe, expect, it } from "vitest";
import { getStore } from "@/lib/data/store";
import { apply } from "@/lib/filters/apply";
import { FilterState, type FilterInput } from "@/lib/filters/state";
import { parse, serialize } from "@/lib/filters/url";

const LONG_SHOT = "9900010";   // fixture: 10¢, our chance 14%, edge +4 pts, tier "edge"
const run = async (f: FilterInput) => apply(await getStore(), FilterState.parse({ view: "flags", group_by_event: false, page_size: 200, ...f }));
const ids = (p: Awaited<ReturnType<typeof run>>) => p.rows.map((r) => r.market.id);

describe("flag tiers", () => {
  it("default is tier best", async () => {
    const p = await run({});
    expect(p.total).toBeGreaterThan(0);
    expect(p.rows.every((r) => (r.market.tier ?? "best") === "best")).toBe(true);
    expect(ids(p)).not.toContain(LONG_SHOT);
  });
  it("the 10x bet with a 14% chance shows in tier edge (chance floor off)", async () => {
    const p = await run({ tier: "edge", win_prob_min: 0 });
    expect(ids(p)).toContain(LONG_SHOT);
    expect(p.rows.every((r) => r.market.tier === "edge")).toBe(true);
  });
  it("Pays 10x+, a typed '10x' search and Biggest payout hit both tiers", async () => {
    expect(ids(await run({ pays_min: 10 }))).toContain(LONG_SHOT);
    expect(ids(await run({ q: "10x" }))).toContain(LONG_SHOT);
    expect(ids(await run({ sort: { key: "pays", dir: "desc" }, win_prob_min: 0 }))).toContain(LONG_SHOT);
  });
  it("the pays facet counts the edge tier", async () => {
    expect((await run({})).facets.pays["10x+"]).toBeGreaterThanOrEqual(1);
  });
  it("tier round-trips through the URL; the markets view ignores it", async () => {
    const f = FilterState.parse({ view: "flags", tier: "edge" });
    expect(serialize(f).get("tier")).toBe("edge");
    expect(parse(serialize(f)).tier).toBe("edge");
    expect(parse("tier=bogus").tier).toBe("best");
    const all = apply(await getStore(), FilterState.parse({ view: "markets", tier: "best", win_prob_min: 0, page_size: 200, group_by_event: false }));
    expect(all.rows.map((r) => r.market.id)).toContain(LONG_SHOT);
    expect(all.rows.find((r) => r.market.id === LONG_SHOT)?.market.tier).toBe("edge");
  });
});
