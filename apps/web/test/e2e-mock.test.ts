import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/e2e-mock/[...path]/route";

const call = () => GET(new Request("http://test/e2e-mock/supabase/_inbox?email=a@b.c"), { params: Promise.resolve({ path: ["supabase", "_inbox"] }) });

describe("e2e mock gate (security)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is a 404 unless E2E_MOCK=1", async () => {
    vi.stubEnv("E2E_MOCK", "");
    expect((await call()).status).toBe(404);
  });
  it("is a 404 in production even with E2E_MOCK=1", async () => {
    vi.stubEnv("E2E_MOCK", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect((await call()).status).toBe(404);
  });
  it("answers in dev/e2e with E2E_MOCK=1", async () => {
    vi.stubEnv("E2E_MOCK", "1");
    expect((await call()).status).toBe(200);
  });
});
