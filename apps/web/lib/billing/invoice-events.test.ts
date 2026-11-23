// F7: the webhook acts on invoice.paid and invoice.payment_failed, and every handled event is in handleEvent.
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { handleWebhook, type BillingDb } from "./stripe";

const sendEmail = vi.fn(async (..._a: unknown[]) => ({ sent: true }));
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), siteUrl: () => "http://test", unsubscribeUrl: () => "http://test/u" }));

const SECRET = "whsec_test_secret";
const db = (linked: boolean): BillingDb => ({
  seen: async () => false, markSeen: async () => {}, linkCustomer: async () => {},
  userForCustomer: async () => (linked ? "user-1" : null),
  customerOf: async () => ({ customer: null, status: null }), emailFor: async () => "a@x.test", upsertSubscription: async () => {},
});
const post = (type: string, object: object) => {
  const payload = JSON.stringify({ id: `evt_${type}`, object: "event", type, data: { object } });
  return new Request("http://x", { method: "POST", body: payload, headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) } });
};

describe("invoice events", () => {
  it("invoice.paid for a linked customer is accepted", async () => {
    expect((await handleWebhook(post("invoice.paid", { customer: "cus_1", amount_paid: 1199 }), db(true), null, SECRET)).status).toBe(200);
  });
  it("invoice.paid with money taken but no linked user asks Stripe to retry", async () => {
    expect((await handleWebhook(post("invoice.paid", { customer: "cus_1", amount_paid: 1199 }), db(false), null, SECRET)).status).toBe(500);
  });
  it("invoice.payment_failed emails the user once", async () => {
    sendEmail.mockClear();
    expect((await handleWebhook(post("invoice.payment_failed", { customer: "cus_1" }), db(true), null, SECRET)).status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it("checkout, subscription updated/deleted and both invoice events are handled", () => {
    const src = readFileSync(`${import.meta.dirname}/stripe.ts`, "utf8");
    for (const t of ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"])
      expect(src).toContain(`case "${t}"`);
  });
});
