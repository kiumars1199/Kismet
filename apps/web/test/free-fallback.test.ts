// Free first screen: onboarding lands on /?view=flags&t=<topics>&fav=1, and the day's random 10-bet Free sample often has
// nothing in a single topic. With fav=1 the server then answers with that user's own unfiltered sample for the day, marked
// free_fallback. It uses the same freeSample() as the default page: no positions, saves or history. Only fav=1 does this.
import { describe, expect, it } from "vitest";
import { FilterState } from "@/lib/filters/state";
import { getStoreFor } from "@/lib/data/store";
import { freeSample, listBody } from "@/lib/data/respond";
import { TAXONOMY } from "@/lib/taxonomy";

const flags = (extra: Record<string, unknown>) => FilterState.parse({ view: "flags", ...extra });

/** A (user key, topic) pair where the topic has bets but none of that user's sample. Found from the data. */
async function emptyCase() {
  const store = await getStoreFor("free");
  const topics = Object.keys((await listBody(store, flags({}), "free", "probe"))!.facets.topics);
  for (let i = 0; i < 40; i++) {
    const key = `u:test-${i}`;
    for (const t of topics) {
      const b = await listBody(store, flags({ topics: [t] }), "free", key);
      if (b && b.total > 0 && b.rows.length === 0) return { store, key, t };
    }
  }
  throw new Error("fixture has no (user, topic) with an empty sample");
}

describe("Free first screen fallback", () => {
  it("fav=1 with a topic that leaves 0 of the day's sample returns that user's own unfiltered sample", async () => {
    const { store, key, t } = await emptyCase();
    const b = (await listBody(store, flags({ topics: [t], favorites_only: true }), "free", key))!;
    const plain = (await listBody(store, flags({}), "free", key))!;
    expect(b.free_fallback).toBe(true);
    expect(b.rows.map((r) => r.market.id)).toEqual(plain.rows.map((r) => r.market.id));
    expect(b.rows.map((r) => r.market.id).sort()).toEqual([...freeSample(store, key)].filter((id) => b.rows.some((r) => r.market.id === id)).sort());
    expect(b.total).toBe(plain.total);   // "Unlock N more" counts the real list
    expect(b.free_daily).toBe(10);
    expect(b.rows.length).toBeGreaterThan(0);
  });

  it("fires only with fav=1: a plain topic filter still answers empty, with no fallback flag", async () => {
    const { store, key, t } = await emptyCase();
    const b = (await listBody(store, flags({ topics: [t] }), "free", key))!;
    expect(b.rows).toHaveLength(0);
    expect(b.free_fallback).toBeUndefined();
  });

  it("not when the sample already has bets in the topics", async () => {
    const store = await getStoreFor("free");
    const key = "u:test-0";
    const topics = Object.keys((await listBody(store, flags({}), "free", key))!.facets.topics);
    for (const t of topics) {
      const plain = (await listBody(store, flags({ topics: [t] }), "free", key))!;
      if (plain.rows.length === 0) continue;
      const b = (await listBody(store, flags({ topics: [t], favorites_only: true }), "free", key))!;
      expect(b.rows.map((r) => r.market.id)).toEqual(plain.rows.map((r) => r.market.id));
      expect(b.free_fallback).toBeUndefined();
      return;
    }
    throw new Error("fixture has no topic with a bet in the day's sample");
  });
});

// T-wt2b: a topic with NO best bets today (total 0) also gets the first-screen fallback, and the answer says which case it is.
describe("Free first screen fallback: a topic with no best bets today", () => {
  async function zeroTopic() {
    const store = await getStoreFor("free");
    const counts = (await listBody(store, flags({}), "free", "probe"))!.facets.topics;
    const t = Object.keys(TAXONOMY).find((id) => id.includes(".") && !counts[id] && !id.endsWith(".other"));
    if (!t) throw new Error("fixture has no topic without best bets");
    return { store, t };
  }
  it("fav=1 with a topic that has 0 best bets returns the user's own unfiltered sample, marked, with the topic's count 0", async () => {
    const { store, t } = await zeroTopic();
    const key = "u:test-zero";
    const raw = (await listBody(store, flags({ topics: [t] }), "free", key))!;
    expect(raw.total).toBe(0);
    const b = (await listBody(store, flags({ topics: [t], favorites_only: true }), "free", key))!;
    const plain = (await listBody(store, flags({}), "free", key))!;
    expect(b.free_fallback).toBe(true);
    expect(b.free_fallback_topic_total).toBe(0);
    expect(b.rows.map((r) => r.market.id)).toEqual(plain.rows.map((r) => r.market.id));
    expect(b.rows).toHaveLength(10);
    expect(b.total).toBe(plain.total);
  });
  it("when the topic has bets but none in the sample the count is that topic's, so the page can tell the two apart", async () => {
    const { store, key, t } = await emptyCase();
    const own = (await listBody(store, flags({ topics: [t] }), "free", key))!.total;
    const b = (await listBody(store, flags({ topics: [t], favorites_only: true }), "free", key))!;
    expect(b.free_fallback_topic_total).toBe(own);
    expect(own).toBeGreaterThan(0);
  });
  it("a plain topic filter with 0 best bets still answers empty (no fallback)", async () => {
    const { store, t } = await zeroTopic();
    const b = (await listBody(store, flags({ topics: [t] }), "free", "u:test-zero"))!;
    expect(b.rows).toHaveLength(0);
    expect(b.free_fallback).toBeUndefined();
  });
});

