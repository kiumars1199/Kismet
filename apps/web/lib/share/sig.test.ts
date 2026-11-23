import { describe, expect, it } from "vitest";
import { shareSig, verifyShareSig } from "./sig";
import { shareCardData, shareableFacts, isShareable, shareLinkParts } from "./card-data";
import { getStoreFor } from "@/lib/data/store";

describe("share signature (HMAC of id|side)", () => {
  it("round-trips for the same id and side, and only for them", () => {
    const sig = shareSig("m1", 0, "k")!;
    expect(verifyShareSig("m1", 0, sig, "k")).toBe(true);
    expect(verifyShareSig("m1", 1, sig, "k")).toBe(false);
    expect(verifyShareSig("m2", 0, sig, "k")).toBe(false);
    expect(verifyShareSig("m1", 0, sig, "other-secret")).toBe(false);
  });
  it("rejects a missing, empty, truncated or tampered signature", () => {
    const sig = shareSig("m1", 0, "k")!;
    for (const bad of [null, undefined, "", sig.slice(0, -1), `${sig}x`, sig.replace(/.$/, (c) => (c === "A" ? "B" : "A"))]) expect(verifyShareSig("m1", 0, bad, "k")).toBe(false);
  });
  it("without a secret nothing is signed and nothing verifies", () => {
    expect(shareSig("m1", 0, "")).toBeNull();
    expect(verifyShareSig("m1", 0, "anything", "")).toBe(false);
  });
});

describe("shareCardData: numbers only for a valid signature", () => {
  it("unsigned and tampered requests get the teaser card, a signed one gets the numbers", async () => {
    const store = await getStoreFor("free");
    const id = [...store.flagsById.keys()][0]!;
    const side = store.flagsById.get(id)!.best.side_index;
    const sig = shareSig(id, side)!;
    expect(await shareCardData(id, side, null)).toMatchObject({ kind: "teaser" });
    expect(await shareCardData(id, side, "forged")).toMatchObject({ kind: "teaser" });
    expect(await shareCardData(id, side === 0 ? 1 : 0, sig)).toMatchObject({ kind: "teaser" });   // a sig for another side
    const ok = await shareCardData(id, side, sig);
    expect(ok).toMatchObject({ kind: "numbers" });
    expect(JSON.stringify(await shareCardData(id, side, null))).not.toMatch(/Pays|won about|win_prob|\d+%/);
  });
  it("null for an unknown market, signed or not", async () => {
    expect(await shareCardData("nope", 0, null)).toBeNull();
    expect(await shareCardData("nope", 0, shareSig("nope", 0))).toBeNull();
  });
});

describe("only flagged bets get a card with numbers (a flag = in flags.json, on its recommended side)", () => {
  it("a positive-edge market that is not a flag gets the teaser and no signed link", async () => {
    const store = await getStoreFor("free");
    const nonFlag = [...store.byId.values()].find((m) => !store.flagsById.has(m.id) && m.best.edge > 0)!;
    expect(nonFlag).toBeTruthy();   // the fixtures hold positive-edge markets that are not flags
    const side = nonFlag.best.side_index;
    expect(isShareable(store, nonFlag.id, side)).toBe(false);
    expect(shareLinkParts(store, nonFlag.id)).toEqual({ id: nonFlag.id, side, sig: null });
    const sig = shareSig(nonFlag.id, side)!;   // even a validly signed request
    expect(await shareCardData(nonFlag.id, side, sig)).toMatchObject({ kind: "teaser" });
    expect(await shareableFacts(nonFlag.id, side, sig)).toBeNull();   // og:description follows the image
  });
  it("a flag on its recommended side gets numbers and a signed link", async () => {
    const store = await getStoreFor("free");
    const flag = [...store.flagsById.values()][0]!;
    const side = flag.best.side_index;
    expect(isShareable(store, flag.id, side)).toBe(true);
    const parts = shareLinkParts(store, flag.id)!;
    expect(parts).toMatchObject({ id: flag.id, side });
    expect(parts.sig).toBe(shareSig(flag.id, side));
    expect(await shareCardData(flag.id, side, parts.sig)).toMatchObject({ kind: "numbers" });
    expect(await shareableFacts(flag.id, side, parts.sig)).not.toBeNull();
  });
  it("a flag on the other side gets the teaser", async () => {
    const store = await getStoreFor("free");
    const flag = [...store.flagsById.values()][0]!;
    const other = flag.sides.find((x) => x.side_index !== flag.best.side_index)!.side_index;
    expect(isShareable(store, flag.id, other)).toBe(false);
    expect(await shareCardData(flag.id, other, shareSig(flag.id, other))).toMatchObject({ kind: "teaser" });
  });
});
