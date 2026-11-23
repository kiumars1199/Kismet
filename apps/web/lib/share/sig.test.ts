import { describe, expect, it } from "vitest";
import { shareSig, verifyShareSig } from "./sig";
import { shareCardData } from "./card-data";
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
