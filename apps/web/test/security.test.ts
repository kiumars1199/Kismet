// docs/15 controls that are plain logic or a grep over the source (Lane X). Evidence map: docs/SECURITY_EVIDENCE.md.
import { describe, expect, it } from "vitest";
import { demoFlag } from "@/lib/config";

describe("DEMO_MODE fails safe", () => {
  it("is on only when explicitly true, or unset outside production", () => {
    expect(demoFlag("true", "production")).toBe(true);
    expect(demoFlag(undefined, "production")).toBe(false);   // forgotten var on a production deploy
    expect(demoFlag("", "production")).toBe(false);
    expect(demoFlag("false", "development")).toBe(false);
    expect(demoFlag("1", "development")).toBe(false);
    expect(demoFlag(undefined, "development")).toBe(true);   // pnpm dev with no .env
    expect(demoFlag(undefined, "test")).toBe(true);
  });
});
