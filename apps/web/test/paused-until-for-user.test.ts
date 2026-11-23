// pausedUntilForUser is read by routes that must not fail because the pause lookup did: any failure, including no
// service-role key configured (supabaseAdmin() throws), reads as "not paused".
import { describe, expect, it, vi } from "vitest";

describe("pausedUntilForUser", () => {
  it("is null, not a throw, when the admin client can't be built", async () => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { pausedUntilForUser } = await import("@/lib/auth/server");
    await expect(pausedUntilForUser("u1")).resolves.toBeNull();
    vi.unstubAllEnvs();
  });
});
