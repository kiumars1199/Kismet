// T-43 webhook: forged / stale signatures rejected, duplicates ignored, tier mapping from price.
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleWebhook, tierFromPrice, type BillingDb, type SubscriptionRow } from "./stripe";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true })), siteUrl: () => "http://test", unsubscribeUrl: () => "http://test/u" }));

const SECRET = "whsec_test_secret";
const U = "user-1";

function memDb() {
  const events = new Set<string>();
  const customers = new Map<string, string>();
  const subs = new Map<string, Partial<SubscriptionRow>>();
  const db: BillingDb & { subs: typeof subs } = {
    subs,
    seen: async (id) => events.has(id),
    markSeen: async (id) => { events.add(id); },
    linkCustomer: async (u, c) => { customers.set(c, u); subs.set(u, { ...subs.get(u), stripe_customer_id: c }); },
    userForCustomer: async (c) => customers.get(c) ?? null,
    emailFor: async () => "a@x.test",
    upsertSubscription: async (u, row) => { subs.set(u, { ...subs.get(u), ...row }); },
  };
  return db;
}

const sub = (status: string, price: Partial<Stripe.Price>, extra: object = {}) => ({
  id: "sub_1", object: "subscription", customer: "cus_1", status, cancel_at_period_end: false, trial_start: null,
  metadata: {}, items: { data: [{ price: { id: "price_x", unit_amount: null, metadata: {}, ...price }, current_period_end: 1_900_000_000 }] },
  ...extra,
});

function signed(event: object, opts: { secret?: string; timestamp?: number } = {}) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? SECRET, timestamp: opts.timestamp });
  return new Request("http://x/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } });
}

const ev = (id: string, type: string, object: object) => ({ id, object: "event", type, data: { object } });

beforeEach(() => {
  vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_m");
  vi.stubEnv("STRIPE_PRICE_PREMIUM_YEARLY", "price_prem_y");
});

describe("stripe webhook", () => {
  it("rejects a forged signature, a missing one and an old timestamp", async () => {
    const db = memDb();
    const e = ev("evt_1", "customer.subscription.updated", sub("active", { id: "price_pro_m" }, { metadata: { user_id: U } }));
    expect((await handleWebhook(signed(e, { secret: "whsec_wrong" }), db, null, SECRET)).status).toBe(400);
    expect((await handleWebhook(new Request("http://x", { method: "POST", body: "{}" }), db, null, SECRET)).status).toBe(400);
    const old = Math.floor(Date.now() / 1000) - 600;
    expect((await handleWebhook(signed(e, { timestamp: old }), db, null, SECRET)).status).toBe(400);
    // tampered body with a valid header for different bytes
    const good = signed(e);
    const tampered = new Request(good.url, { method: "POST", body: JSON.stringify({ ...e, id: "evt_evil" }), headers: good.headers });
    expect((await handleWebhook(tampered, db, null, SECRET)).status).toBe(400);
    expect(db.subs.size).toBe(0);
  });

  it("links the customer on checkout, then sets the tier from subscription events", async () => {
    const db = memDb();
    const done = ev("evt_c", "checkout.session.completed", { id: "cs_1", object: "checkout.session", client_reference_id: U, customer: "cus_1", subscription: null });
    expect((await handleWebhook(signed(done), db, null, SECRET)).status).toBe(200);
    const created = ev("evt_s", "customer.subscription.created", sub("trialing", { id: "price_pro_m" }, { trial_start: 1_800_000_000 }));
    expect((await handleWebhook(signed(created), db, null, SECRET)).status).toBe(200);
    expect(db.subs.get(U)).toMatchObject({ tier: "pro", status: "trialing", stripe_customer_id: "cus_1", trialed_at: expect.any(String) });
  });

  it("ignores a duplicate event id", async () => {
    const db = memDb();
    const e = ev("evt_dup", "customer.subscription.updated", sub("active", { id: "price_prem_y" }, { metadata: { user_id: U } }));
    await handleWebhook(signed(e), db, null, SECRET);
    db.subs.set(U, { tier: "free" });  // if processed again it would flip back to premium
    const res = await handleWebhook(signed(e), db, null, SECRET);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(db.subs.get(U)?.tier).toBe("free");
  });

  it("downgrades to free when the subscription is canceled or unpaid", async () => {
    const db = memDb();
    await handleWebhook(signed(ev("e1", "customer.subscription.deleted", sub("canceled", { id: "price_pro_m" }, { metadata: { user_id: U } }))), db, null, SECRET);
    expect(db.subs.get(U)?.tier).toBe("free");
    await handleWebhook(signed(ev("e2", "customer.subscription.updated", sub("past_due", { id: "price_pro_m" }, { metadata: { user_id: U } }))), db, null, SECRET);
    expect(db.subs.get(U)?.tier).toBe("pro");   // past_due keeps access while Stripe retries the card
    await handleWebhook(signed(ev("e3", "customer.subscription.updated", sub("unpaid", { id: "price_pro_m" }, { metadata: { user_id: U } }))), db, null, SECRET);
    expect(db.subs.get(U)?.tier).toBe("free");
  });

  it("asks Stripe to retry when the customer isn't linked yet (and doesn't mark it seen)", async () => {
    const db = memDb();
    const e = ev("evt_early", "customer.subscription.created", sub("active", { id: "price_pro_m" }));
    expect((await handleWebhook(signed(e), db, null, SECRET)).status).toBe(500);
    expect(await db.seen("evt_early")).toBe(false);
  });
});

describe("tierFromPrice", () => {
  it("maps env price ids, metadata, then Payment Link amounts", () => {
    expect(tierFromPrice({ id: "price_pro_m" })).toBe("pro");
    expect(tierFromPrice({ id: "price_prem_y" })).toBe("premium");
    expect(tierFromPrice({ id: "p", metadata: { tier: "premium" } })).toBe("premium");
    expect(tierFromPrice({ id: "p", unit_amount: 1900 })).toBe("pro");
    expect(tierFromPrice({ id: "p", unit_amount: 29000 })).toBe("premium");
    expect(tierFromPrice({ id: "p", unit_amount: 500 })).toBeNull();
    expect(tierFromPrice(null)).toBeNull();
  });
});
