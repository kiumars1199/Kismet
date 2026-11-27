// F15 follow-up: before 20261127000000 is applied the billing_interval column doesn't exist. The webhook must still
// save the plan (billing can't stop on an admin-only column); any other error still fails the event.
import { describe, expect, it, vi } from "vitest";

const calls: Record<string, unknown>[] = [];
let missingColumn = true;
let otherError: string | null = null;
vi.mock("@/lib/auth/server", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        calls.push(row);
        if (otherError) return { error: { message: otherError } };
        if (missingColumn && "billing_interval" in row) return { error: { message: "Could not find the 'billing_interval' column of 'subscriptions' in the schema cache" } };
        return { error: null };
      },
    }),
  }),
}));
const { supabaseBillingDb } = await import("./db");
const row = { stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", tier: "pro" as const, status: "active", current_period_end: null, cancel_at_period_end: false };

describe("upsertSubscription and billing_interval", () => {
  it("saves the plan without the interval when the column isn't there yet", async () => {
    calls.length = 0; missingColumn = true; otherError = null;
    await supabaseBillingDb().upsertSubscription("u1", { ...row, billing_interval: "year" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ user_id: "u1", tier: "pro", status: "active" });
    expect(calls[1]).not.toHaveProperty("billing_interval");
  });

  it("saves the interval once the column exists, in one write", async () => {
    calls.length = 0; missingColumn = false; otherError = null;
    await supabaseBillingDb().upsertSubscription("u1", { ...row, billing_interval: "year" });
    expect(calls).toEqual([expect.objectContaining({ billing_interval: "year" })]);
  });

  it("any other error still throws (Stripe retries)", async () => {
    calls.length = 0; otherError = "connection refused";
    await expect(supabaseBillingDb().upsertSubscription("u1", { ...row, billing_interval: "month" })).rejects.toThrow("connection refused");
    expect(calls).toHaveLength(1);
  });
});
