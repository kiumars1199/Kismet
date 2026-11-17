// T-40: runs the real migrations in an in-process Postgres (PGlite) with a minimal stand-in for
// Supabase's auth schema, then proves RLS: user B can't see or touch user A's rows, anon sees nothing,
// every public table has rowsecurity = true, and the signup / session-limit triggers work.
// The same checks against a real Supabase DB: supabase/tests/rls.test.sql (pgTAP, `supabase test db`).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIG = path.resolve(__dirname, "../../../supabase/migrations");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

// What Supabase provides before user migrations run (trimmed to what ours touch).
const AUTH_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create table auth.sessions (id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;
const GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
`;

let db: PGlite;

async function as<T>(role: "anon" | "authenticated", sub: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(MIG, f), "utf8"));
  }
  await db.exec(GRANTS);
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.test'), ('${B}', 'b@x.test');`);
  await as("authenticated", A, `insert into presets (name, query) values ('A view', '{"v":1}')`);
  await as("authenticated", A, `insert into watchlist (market_id, side_index) values ('m1', null)`);
  await as("authenticated", A, `insert into journal (market_id, side_index, price, shares) values ('m1', 0, 0.5, 10)`);
}, 60_000);

describe("RLS (supabase/migrations)", () => {
  it("every public table has row level security on", async () => {
    const rows = (await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public'")).rows;
    expect(rows.length).toBeGreaterThanOrEqual(11);
    expect(rows.filter((r) => !r.rowsecurity)).toEqual([]);
  });

  it("signup trigger creates profile + free subscription", async () => {
    const subs = (await db.query<{ user_id: string; tier: string }>("select user_id, tier from subscriptions order by user_id")).rows;
    expect(subs).toEqual([{ user_id: A, tier: "free" }, { user_id: B, tier: "free" }]);
    expect((await db.query("select 1 from profiles")).rows).toHaveLength(2);
  });

  it("user B sees none of user A's rows", async () => {
    for (const t of ["presets", "watchlist", "journal", "profiles", "subscriptions"]) {
      const mine = await as<{ user_id: string }>("authenticated", B, `select user_id from ${t}`);
      expect(mine.every((r) => r.user_id === B), t).toBe(true);
    }
    expect(await as("authenticated", B, "select * from presets")).toEqual([]);
    expect(await as("authenticated", A, "select * from presets")).toHaveLength(1);
  });

  it("user B can't update or delete A's rows, nor insert rows as A", async () => {
    await as("authenticated", B, "update presets set name = 'hacked'");
    await as("authenticated", B, "delete from journal");
    expect((await db.query<{ name: string }>("select name from presets")).rows[0].name).toBe("A view");
    expect((await db.query("select 1 from journal")).rows).toHaveLength(1);
    await expect(as("authenticated", B, `insert into presets (user_id, name, query) values ('${A}', 'x', '{}')`)).rejects.toThrow(/row-level security/);
  });

  it("users can't write their own tier; anon sees nothing", async () => {
    await as("authenticated", A, "update subscriptions set tier = 'premium'");
    expect((await db.query<{ tier: string }>(`select tier from subscriptions where user_id = '${A}'`)).rows[0].tier).toBe("free");
    await expect(as("authenticated", A, "insert into stripe_events (id, type) values ('evt', 'x')")).rejects.toThrow(/row-level security/);
    for (const t of ["presets", "profiles", "subscriptions", "stripe_events", "journal"]) {
      expect(await as("anon", null, `select * from ${t}`), t).toEqual([]);
    }
  });

  it("watchlist: one whole-market row per market (nulls not distinct)", async () => {
    await expect(as("authenticated", A, "insert into watchlist (market_id, side_index) values ('m1', null)")).rejects.toThrow(/duplicate key/);
  });

  it("keeps at most 3 sessions per user, newest win", async () => {
    for (let i = 1; i <= 4; i++) {
      await db.exec(`insert into auth.sessions (user_id, created_at) values ('${A}', now() + interval '${i} minutes')`);
    }
    const left = (await db.query<{ n: number }>(
      `select (created_at > now() + interval '90 seconds') as n from auth.sessions where user_id = '${A}'`)).rows;
    expect(left).toEqual([{ n: true }, { n: true }, { n: true }]); // the +1 min session was dropped
  });

  it("deleting the auth user removes every row (delete account)", async () => {
    await db.exec(`delete from auth.users where id = '${A}'`);
    for (const t of ["presets", "watchlist", "journal", "profiles", "subscriptions"]) {
      expect((await db.query(`select 1 from ${t} where user_id = '${A}'`)).rows, t).toEqual([]);
    }
  });
});
