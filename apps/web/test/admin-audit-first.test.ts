// RT3-05: the audit row is written before the change; if it can't be written, nothing changes. The settings
// "before" value is read from app_settings, not the 60 s per-instance cache.
import { afterEach, describe, expect, it, vi } from "vitest";

const owner = { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com", verified: true };
const target = "00000000-0000-4000-8000-000000000002";

type Op = [table: string, op: string, payload?: unknown];
function fakeDb({ auditFails = false, settings = [] as { key: string; value: unknown }[] } = {}) {
  const ops: Op[] = [];
  const from = (table: string) => {
    const q = {
      select: () => q, eq: () => q, in: () => q,
      maybeSingle: async () => ({ data: { comp_tier: null, comp_expires_at: null }, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: table === "app_settings" ? settings : [], error: null }).then(ok),
      insert: async (row: unknown) => {
        ops.push([table, "insert", row]);
        if (table === "admin_audit_log") order.push(`audit:${(row as { action?: string }).action}`);
        return { error: table === "admin_audit_log" && auditFails ? { message: "down" } : null };
      },
      upsert: async (row: unknown) => { ops.push([table, "upsert", row]); return { error: null }; },
    };
    return q;
  };
  const db = {
    from,
    rpc: async (name: string) => { ops.push([name, "rpc"]); return { data: 1, error: null }; },
    auth: { admin: { getUserById: async () => ({ data: { user: { id: target, email: "t@example.com" } } }) } },
  };
  return { db, ops };
}

async function post(db: object, body: object) {
  vi.doMock("@/lib/admin/server", async (orig) => ({ ...(await orig<object>()), requireAdmin: async () => ({ admin: owner, db }) }));
  vi.doMock("@/lib/settings", () => ({ getSettings: async () => ({ free_rows: 999 }), bustSettings: () => {} }));   // a stale cache
  vi.doMock("@/lib/abuse", () => ({ rateLimit: async () => null }));
  const { POST } = await import("@/app/api/admin/route");
  return POST(new Request("https://me.test/api/admin", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://me.test", host: "me.test" }, body: JSON.stringify(body),
  }));
}
const revalidated: string[] = [];
let order: string[] = [];   // the shared timeline of audit inserts and revalidations
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => void (revalidated.push(p), order.push("revalidate")) }));
afterEach(() => { revalidated.length = 0; order = []; vi.resetModules(); vi.doUnmock("@/lib/admin/server"); vi.doUnmock("@/lib/settings"); vi.doUnmock("@/lib/abuse"); });

describe("admin: audit first", () => {
  for (const body of [
    { action: "comp", user_id: target, tier: "pro", expires_at: null },
    { action: "revoke_sessions", user_id: target, confirm: "t@example.com" },
    { action: "settings", patch: { free_rows: 10 } },
  ]) {
    it(`${body.action}: a failed audit write applies nothing and answers 500`, async () => {
      const { db, ops } = fakeDb({ auditFails: true });
      const res = await post(db, body);
      expect(res.status).toBe(500);
      expect(ops.filter(([t]) => t !== "admin_audit_log")).toEqual([]);
    });
  }

  it("settings: the audit row comes first and its before value is read from the table", async () => {
    const { db, ops } = fakeDb({ settings: [{ key: "free_rows", value: 40 }] });
    const res = await post(db, { action: "settings", patch: { free_rows: 10 } });
    expect(res.status).toBe(200);
    expect(ops[0]![0]).toBe("admin_audit_log");
    expect((ops[0]![2] as { before: unknown }).before).toEqual({ free_rows: 40 });
    expect(ops.some(([t, o]) => t === "app_settings" && o === "upsert")).toBe(true);
  });

  it("settings: the prerendered pages are regenerated at once, so the banner and maintenance mode show on / without waiting for the 5-minute window", async () => {
    const { STATIC_PAGES } = await import("@/lib/static-routes");
    const { db } = fakeDb({ settings: [{ key: "banner_on", value: false }] });
    expect((await post(db, { action: "settings", patch: { banner_on: true } })).status).toBe(200);
    expect(revalidated.sort()).toEqual([...STATIC_PAGES].sort());
  });

  it("settings: the pages are regenerated after the .done audit row, not before", async () => {
    const { db } = fakeDb();
    expect((await post(db, { action: "settings", patch: { banner_on: true } })).status).toBe(200);
    const doneAt = order.indexOf("audit:settings.update.done");
    expect(doneAt).toBeGreaterThan(-1);
    expect(order.indexOf("revalidate")).toBeGreaterThan(doneAt);
  });

  it("settings: a failed audit write regenerates nothing", async () => {
    const { db } = fakeDb({ auditFails: true });
    expect((await post(db, { action: "settings", patch: { banner_on: true } })).status).toBe(500);
    expect(revalidated).toEqual([]);   // nothing changed, nothing regenerated
  });
});
