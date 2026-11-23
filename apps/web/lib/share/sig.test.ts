import { describe, expect, it } from "vitest";
import { shareSig, verifyShareSig } from "./sig";
import { shareCardData, shareableFacts, isShareable } from "./card-data";
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

describe("only flagged bets get a card with numbers (best side with edge > 0)", () => {
  it("a best side with edge <= 0 gets the teaser even with a valid signature, in the image and the description", async () => {
    const store = await getStoreFor("free");
    const all = [...store.byId.values()];
    const flagged = all.find((m) => m.best.edge > 0)!;
    const unflagged = all.find((m) => !(m.best.edge > 0))!;
    expect(unflagged).toBeTruthy();
    expect(isShareable(store, flagged.id, flagged.best.side_index)).toBe(true);
    expect(isShareable(store, unflagged.id, unflagged.best.side_index)).toBe(false);
    const other = flagged.sides.find((x) => x.side_index !== flagged.best.side_index)!;
    expect(isShareable(store, flagged.id, other.side_index)).toBe(false);   // only the recommended side
    const sig = shareSig(unflagged.id, unflagged.best.side_index)!;
    expect(await shareCardData(unflagged.id, unflagged.best.side_index, sig)).toMatchObject({ kind: "teaser" });
    expect(await shareableFacts(unflagged.id, unflagged.best.side_index, sig)).toBeNull();   // og:description follows the image
    const fsig = shareSig(flagged.id, flagged.best.side_index)!;
    expect(await shareCardData(flagged.id, flagged.best.side_index, fsig)).toMatchObject({ kind: "numbers" });
    expect(await shareableFacts(flagged.id, flagged.best.side_index, fsig)).not.toBeNull();
  });
});
