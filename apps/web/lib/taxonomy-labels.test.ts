// Two topics must never read the same on screen (onboarding showed "Up or down" under both Crypto and Finance).
import { describe, expect, it } from "vitest";
import { TAXONOMY } from "./taxonomy";

describe("topic labels", () => {
  it("no two visible topic labels are equal across the whole taxonomy", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const n of Object.values(TAXONOMY)) {
      if (n.id.endsWith(".other")) continue;   // "Other" is the catch-all inside each category, shown only in-category
      const key = n.label.trim().toLowerCase();
      const first = seen.get(key);
      if (first) dupes.push(`"${n.label}": ${first} and ${n.id}`);
      else seen.set(key, n.id);
    }
    expect(dupes).toEqual([]);
  });
  it("the two up-or-down topics say what they are", () => {
    expect(TAXONOMY["crypto.up-or-down"]!.label).toBe("Crypto up or down");
    expect(TAXONOMY["finance.finance-updown"]!.label).toBe("Stock market up or down");
  });
});
