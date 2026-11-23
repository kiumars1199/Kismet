// F15: the webhook records what each invoice.paid brought in (stripe_events.amount_cents), for the admin's daily revenue.
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { handleWebhook, type BillingDb } from "./stripe";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true })), siteUrl: () => "http://test", unsubscribeUrl: () => "http://test/u" }));

const SECRET = "whsec_test_secret";
type Mark = { id: string; type: string; extra?: { amount_cents?: number | null; customer?: string | null } };

function db(marks: Mark[]): BillingDb {
  return {
    seen: async () => false,
    markSeen: async (id, type, extra) => { marks.push({ id, type, extra }); },
    linkCustomer: async () => {}, userForCustomer: async () => "user-1",
    customerOf: async () => ({ customer: null, status: null }), emailFor: async () => "a@x.test", upsertSubscription: async () => {},
  };
}
const post = (id: string, type: string, object: object) => {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  return new Request("http://x", { method: "POST", body: payload, headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) } });
};

describe("revenue ledger", () => {
  it("invoice.paid records the amount paid in cents and the customer", async () => {
    const marks: Mark[] = [];
    const res = await handleWebhook(post("evt_p1", "invoice.paid", { customer: "cus_1", amount_paid: 1199 }), db(marks), null, SECRET);
    expect(res.status).toBe(200);
    expect(marks).toEqual([{ id: "evt_p1", type: "invoice.paid", extra: { amount_cents: 1199, customer: "cus_1" } }]);
  });
  it("a $0 invoice (a trial start) records 0", async () => {
    const marks: Mark[] = [];
    await handleWebhook(post("evt_p0", "invoice.paid", { customer: "cus_1", amount_paid: 0 }), db(marks), null, SECRET);
    expect(marks[0]!.extra).toEqual({ amount_cents: 0, customer: "cus_1" });
  });
  it("other events record no amount", async () => {
    const marks: Mark[] = [];
    await handleWebhook(post("evt_d", "customer.subscription.deleted", { id: "sub_1", object: "subscription", customer: "cus_1", status: "canceled", metadata: { user_id: "user-1" }, items: { data: [] } }), db(marks), null, SECRET);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.extra?.amount_cents ?? null).toBeNull();
  });
  it("a malformed amount is stored as null, never NaN", async () => {
    const marks: Mark[] = [];
    await handleWebhook(post("evt_bad", "invoice.paid", { customer: "cus_1", amount_paid: "12" }), db(marks), null, SECRET);
    expect(marks[0]!.extra?.amount_cents ?? null).toBeNull();
  });
});
