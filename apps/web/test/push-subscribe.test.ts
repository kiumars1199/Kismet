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

// Second account on the same browser: the endpoint is globally unique and RLS hides the other user's row, so the
// upsert fails. claim_push_subscription (security definer) moves the row only when the caller sends the same
// endpoint AND the same keys, which only the browser holding that subscription knows.
type Row = Record<string, unknown>;
function asUser(tables: Record<string, Row[]>, uid: string) {
  const d = fakeSupabase(tables);
  const rls = { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
  const from = (t: string) => {
    const b = d.from(t) as ReturnType<typeof d.from> & { upsert: (row: Row, o?: unknown) => unknown };
    const up = b.upsert;
    b.upsert = (row: Row, o?: unknown) => {
      if (d.tables[t]!.some((r) => r.endpoint === row.endpoint && r.user_id !== uid))
        return { then: (ok: (v: unknown) => unknown) => Promise.resolve(rls).then(ok) } as never;
      return up(row, o as never);
    };
    return b;
  };
  // the service-role client: only the rpc is used
  const rpc = async (fn: string, a: { p_user: string; p_endpoint: string; p_keys: { p256dh?: string; auth?: string } }) => {
    if (fn !== "claim_push_subscription" || a.p_user !== uid) return { data: null, error: { message: "no such function" } };
    const rows = d.tables.push_subscriptions!;
    if (rows.filter((r) => r.user_id === uid).length >= 10) return { data: false, error: null };
    const r = rows.find((x) => {
      const k = x.keys as { p256dh?: string; auth?: string };
      return x.endpoint === a.p_endpoint && k.p256dh === a.p_keys.p256dh && k.auth === a.p_keys.auth;
    });
    if (!r) return { data: false, error: null };
    r.user_id = uid;
    return { data: true, error: null };
  };
  return { db: { from }, admin: { rpc }, tables: d.tables };
}

describe("push subscribe: second account on the same browser (F10 review)", () => {
  const owned = () => ({ push_subscriptions: [{ user_id: "u1", endpoint: sub().endpoint, keys: sub().keys } as Row] });

  it("moves the device to the signed-in account when endpoint and keys match", async () => {
    const d = asUser(owned(), "u2");
    expect((await saveSubscription(d.db as never, "u2", "pro", sub(), d.admin as never)).status).toBe(200);
    expect(d.tables.push_subscriptions).toEqual([expect.objectContaining({ user_id: "u2", endpoint: sub().endpoint })]);
  });

  it("does not move it when the keys differ (knowing the endpoint is not enough)", async () => {
    const d = asUser(owned(), "u2");
    const res = await saveSubscription(d.db as never, "u2", "pro", sub({ keys: { p256dh: "other", auth: "other" } }), d.admin as never);
    expect(res.status).toBe(500);
    expect(d.tables.push_subscriptions!.map((r) => r.user_id)).toEqual(["u1"]);
  });

  it("without the service-role client it reports the error and moves nothing", async () => {
    const d = asUser(owned(), "u2");
    expect((await saveSubscription(d.db as never, "u2", "pro", sub())).status).toBe(500);
    expect(d.tables.push_subscriptions!.map((r) => r.user_id)).toEqual(["u1"]);
  });
});
