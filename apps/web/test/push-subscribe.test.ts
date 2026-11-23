// F10: POST /api/push/subscribe stores a push subscription for the signed-in user (fake Supabase, no real push service).
import { describe, expect, it } from "vitest";
import { removeSubscription, saveSubscription } from "@/lib/alerts-push-store";
import { fakeSupabase } from "./fakeSupabase";

const sub = (o: Record<string, unknown> = {}) => ({
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: "BPubKeyTestOnly", auth: "authTestOnly" }, ...o,
});
const fresh = () => fakeSupabase({ push_subscriptions: [] });

describe("push subscribe (F10)", () => {
  it("stores the subscription for the user and returns 200", async () => {
    const d = fresh();
    const res = await saveSubscription(d as never, "u1", "pro", sub());
    expect(res.status).toBe(200);
    expect(d.tables.push_subscriptions).toEqual([expect.objectContaining({ user_id: "u1", endpoint: sub().endpoint, keys: sub().keys })]);
  });

  it("is idempotent: the same endpoint twice is one row", async () => {
    const d = fresh();
    await saveSubscription(d as never, "u1", "premium", sub());
    await saveSubscription(d as never, "u1", "premium", sub());
    expect(d.tables.push_subscriptions).toHaveLength(1);
  });

  it("Free gets 403 and nothing is stored", async () => {
    const d = fresh();
    expect((await saveSubscription(d as never, "u1", "free", sub())).status).toBe(403);
    expect(d.tables.push_subscriptions).toHaveLength(0);
  });

  it("rejects bad bodies: not https, not a known push service (no server requests to arbitrary hosts), missing keys, extra fields", async () => {
    const d = fresh();
    for (const bad of [
      sub({ endpoint: "http://fcm.googleapis.com/x" }),
      sub({ endpoint: "https://169.254.169.254/latest" }),
      sub({ endpoint: "https://evil.example/fcm.googleapis.com" }),
      sub({ endpoint: "https://fcm.googleapis.com.evil.example/x" }),
      sub({ keys: { p256dh: "x" } }),
      sub({ extra: 1 }),
      null, "x",
    ]) expect((await saveSubscription(d as never, "u1", "pro", bad)).status).toBe(400);
    expect(d.tables.push_subscriptions).toHaveLength(0);
  });

  it("accepts the push services the browsers use", async () => {
    const d = fresh();
    for (const host of ["updates.push.services.mozilla.com", "web.push.apple.com", "wns2-par02p.notify.windows.com"])
      expect((await saveSubscription(d as never, "u1", "pro", sub({ endpoint: `https://${host}/wpush/v2/abc` }))).status).toBe(200);
  });

  it("caps a user at 10 devices", async () => {
    const d = fresh();
    for (let i = 0; i < 10; i++) await saveSubscription(d as never, "u1", "pro", sub({ endpoint: `https://fcm.googleapis.com/fcm/send/${i}` }));
    expect((await saveSubscription(d as never, "u1", "pro", sub({ endpoint: "https://fcm.googleapis.com/fcm/send/11" }))).status).toBe(409);
  });

  it("DELETE removes only the caller's row for that endpoint", async () => {
    const d = fakeSupabase({ push_subscriptions: [
      { user_id: "u1", endpoint: "https://fcm.googleapis.com/fcm/send/a", keys: {} },
      { user_id: "u2", endpoint: "https://fcm.googleapis.com/fcm/send/a2", keys: {} },
    ] });
    expect((await removeSubscription(d as never, "u1", { endpoint: "https://fcm.googleapis.com/fcm/send/a" })).status).toBe(200);
    expect(d.tables.push_subscriptions!.map((r) => r.user_id)).toEqual(["u2"]);
  });
});
