import { describe, expect, it } from "vitest";
import { safeNext } from "./next-path";

describe("safeNext", () => {
  it("keeps same-site paths and refuses the rest", () => {
    expect(safeNext("/?us=0")).toBe("/?us=0");
    expect(safeNext("/bets/x")).toBe("/bets/x");
    for (const v of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "bets", "/state?next=/"]) expect(safeNext(v), String(v)).toBeNull();
  });
});
