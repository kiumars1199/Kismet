import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memoryLimiter, setLimiter } from "@/lib/abuse";
import { checkWouldLimit, countCheck } from "./limit";

const req = new Request("http://localhost/check");

describe("checkWouldLimit (read only)", () => {
  beforeEach(() => setLimiter(memoryLimiter()));
  afterEach(() => setLimiter(undefined));

  it("is false before any check, and peeking never uses the allowance", async () => {
    for (let i = 0; i < 5; i++) expect(await checkWouldLimit(req, "free", "u1", "m1", 0)).toBe(false);
    expect((await countCheck(req, "free", "u1", "m1", 0)).ok).toBe(true);   // the first real check still goes through
  });

  it("is true for another market or side once the day's check is used, false for the same one (re-opening is free)", async () => {
    await countCheck(req, "free", "u1", "m1", 0);
    expect(await checkWouldLimit(req, "free", "u1", "m2", 0)).toBe(true);
    expect(await checkWouldLimit(req, "free", "u1", "m1", 1)).toBe(true);
    expect(await checkWouldLimit(req, "free", "u1", "m1", 0)).toBe(false);
    expect((await countCheck(req, "free", "u1", "m2", 0)).ok).toBe(false);   // and the API agrees with what the page said
  });

  it("is per account: a new signup in the same browser, or a paid plan, is not limited", async () => {
    await countCheck(req, "free", null, "m1", 0);   // signed out, this device
    expect(await checkWouldLimit(req, "free", null, "m2", 0)).toBe(true);
    expect(await checkWouldLimit(req, "free", "new-user", "m2", 0)).toBe(false);
    expect(await checkWouldLimit(req, "pro", "u1", "m2", 0)).toBe(false);
  });
});
