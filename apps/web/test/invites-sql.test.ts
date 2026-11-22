// F13: the invites migration in PGlite (same harness as test/rls.test.ts): RLS keeps invite rows private to the inviter,
// clients can't write them, and grant_invite_reward() grants Premium once at 5, stacks onto a comp end date and never
// lowers a paid plan. The same RLS checks for a real database: supabase/tests/invites.test.sql.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIG = path.resolve(__dirname, "../../../supabase/migrations");
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const A = uid(1);
const B = uid(2);

const AUTH_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz,
  created_at timestamptz default now(), last_sign_in_at timestamptz);
create table auth.sessions (id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade, created_at timestamptz default now(),
  updated_at timestamptz, refreshed_at timestamp, oauth_client_id uuid);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
`;
const GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
`;

let db: PGlite;
let next = 100;

async function as<T>(role: "authenticated", sub: string, sql: string) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub}', false);`);
  try { return (await db.query<T>(sql)).rows; } finally { await db.exec("reset role;"); }
}

/** A fresh inviter with `n` verified sign-ups; returns its id. */
async function inviterWith(n: number, sub: Record<string, string> = {}) {
  const id = uid(next++);
  await db.exec(`insert into auth.users (id, email) values ('${id}', '${id}@inv.test');`);
  for (let i = 0; i < n; i++) {
    const invitee = uid(next++);
    await db.exec(`insert into auth.users (id, email) values ('${invitee}', '${invitee}@in.test');
      insert into invites (inviter_id, invitee_id, code, status, verified_at) values ('${id}', '${invitee}', 'abcd1234', 'verified', now());`);
  }
  if (Object.keys(sub).length) {
    const set = Object.entries(sub).map(([k, v]) => `${k} = ${v}`).join(", ");
    await db.exec(`update subscriptions set ${set} where user_id = '${id}'`);
  }
  return id;
}
const reward = async (id: string) => (await db.query<{ r: { granted: boolean; reason?: string; comp_until?: string } }>(`select grant_invite_reward('${id}') as r`)).rows[0]!.r;
const subOf = async (id: string) => (await db.query<{ tier: string; comp_tier: string | null; days: number | null }>(
  `select tier, comp_tier, extract(epoch from (comp_expires_at - now())) / 86400 as days from subscriptions where user_id = '${id}'`)).rows[0]!;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(path.join(MIG, f), "utf8"));
  await db.exec(GRANTS);
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.test'), ('${B}', 'b@x.test');`);
  await db.exec(`insert into invite_codes (user_id, code) values ('${A}', 'aaaa1111'), ('${B}', 'bbbb2222');`);
  await db.exec(`insert into auth.users (id, email) values ('${uid(50)}', 'i1@x.test');
    insert into invites (inviter_id, invitee_id, code, status) values ('${A}', '${uid(50)}', 'aaaa1111', 'verified');`);
}, 60_000);

describe("invites RLS", () => {
  it("every public table still has RLS on", async () => {
    const rows = (await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' and not rowsecurity")).rows;
    expect(rows).toEqual([]);
  });
  it("the inviter sees their own invite rows, user B sees none of A's", async () => {
    expect(await as("authenticated", A, "select id from invites")).toHaveLength(1);
    expect(await as("authenticated", B, "select id from invites")).toHaveLength(0);
    expect(await as("authenticated", A, "select code from invite_codes")).toHaveLength(1);
    expect(await as("authenticated", B, "select code from invite_codes where user_id = '" + A + "'")).toHaveLength(0);
  });
  it("clients cannot insert, update or delete invite rows, codes or rewards", async () => {
    await expect(as("authenticated", A, `insert into invites (inviter_id, invitee_id, code, status) values ('${A}', '${uid(51)}', 'x', 'verified')`)).rejects.toThrow();
    await expect(as("authenticated", A, `insert into invite_codes (user_id, code) values ('${uid(52)}', 'cccc3333')`)).rejects.toThrow();
    await expect(as("authenticated", A, `insert into invite_rewards (inviter_id, outcome) values ('${A}', 'granted')`)).rejects.toThrow();
    expect(await as("authenticated", A, "update invites set status = 'rejected' returning id")).toHaveLength(0);
    expect(await as("authenticated", A, "delete from invites returning id")).toHaveLength(0);
    expect((await db.query("select 1 from invites where status = 'verified'")).rows).toHaveLength(1);
  });
  it("clients cannot call grant_invite_reward", async () => {
    await db.exec("revoke all on all tables in schema public from authenticated;");   // as in Supabase's real grants for these tables
    await db.exec("revoke execute on function grant_invite_reward(uuid) from authenticated, anon;");
    await expect(as("authenticated", A, `select grant_invite_reward('${A}')`)).rejects.toThrow();
  });
});

describe("grant_invite_reward", () => {
  it("does nothing below 5 verified sign-ups", async () => {
    const id = await inviterWith(4);
    expect(await reward(id)).toMatchObject({ granted: false, reason: "below_threshold" });
    expect((await subOf(id)).comp_tier).toBeNull();
  });
  it("grants 30 days of Premium at 5, and only once", async () => {
    const id = await inviterWith(5);
    expect(await reward(id)).toMatchObject({ granted: true });
    const s = await subOf(id);
    expect(s).toMatchObject({ tier: "free", comp_tier: "premium" });
    expect(Number(s.days)).toBeGreaterThan(29.9);
    expect(Number(s.days)).toBeLessThan(30.1);
    expect(await reward(id)).toMatchObject({ granted: false, reason: "already_rewarded" });
    const again = await subOf(id);
    expect(Number(again.days)).toBeLessThan(30.1);
  });
  it("stacks onto an existing comp end date", async () => {
    const id = await inviterWith(5, { comp_tier: "'pro'", comp_expires_at: "now() + interval '10 days'" });
    await reward(id);
    const s = await subOf(id);
    expect(s.comp_tier).toBe("premium");
    expect(Number(s.days)).toBeGreaterThan(39.9);
    expect(Number(s.days)).toBeLessThan(40.1);
  });
  it("an expired comp starts from now", async () => {
    const id = await inviterWith(5, { comp_tier: "'premium'", comp_expires_at: "now() - interval '5 days'" });
    await reward(id);
    expect(Number((await subOf(id)).days)).toBeLessThan(30.1);
  });
  it("paid Pro keeps its plan and gets Premium comp on top", async () => {
    const id = await inviterWith(5, { tier: "'pro'", status: "'active'" });
    expect(await reward(id)).toMatchObject({ granted: true });
    expect(await subOf(id)).toMatchObject({ tier: "pro", comp_tier: "premium" });
  });
  it("paid Premium is never touched", async () => {
    const id = await inviterWith(5, { tier: "'premium'", status: "'active'" });
    expect(await reward(id)).toMatchObject({ granted: false, reason: "paid_premium" });
    expect(await subOf(id)).toMatchObject({ tier: "premium", comp_tier: null });
  });
  it("a comp with no end date is never replaced by a shorter one", async () => {
    const id = await inviterWith(5, { comp_tier: "'premium'" });
    expect(await reward(id)).toMatchObject({ granted: false, reason: "open_ended_comp" });
    expect(await subOf(id)).toMatchObject({ comp_tier: "premium", days: null });
  });
});
