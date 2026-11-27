// F15: admin_metrics() against a seeded fixture in PGlite with the real migrations. Hand-computed expectations.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIG = path.resolve(__dirname, "../../../supabase/migrations");
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
const U = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
/** Noon UTC, `n` days before today (UTC), as a timestamptz literal expression. */
const ago = (n: number) => `((date_trunc('day', now() at time zone 'utc') - interval '${n} days' + interval '12 hours') at time zone 'utc')`;

interface Day { day: string; signups: number; trials: number; payments: number; revenue_cents: number | null; churned: number; invites_sent: number; invites_verified: number }
interface M { days: Day[]; revenue_since: string | null; paying: { pro: number; premium: number }; mrr_cents: number }

let db: PGlite;
const metrics = async () => (await db.query<{ m: M }>("select public.admin_metrics(1199, 1999) as m")).rows[0]!.m;
const dayOf = (m: M, n: number) => m.days.at(-1 - n)!;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(path.join(MIG, f), "utf8"));
  await db.exec(`grant usage on schema public to anon, authenticated, service_role; grant all on all tables in schema public to anon, authenticated, service_role;`);
  // users: 2 today, 1 three days ago, 1 forty days ago (outside the window), 2 more with subscriptions
  await db.exec(`
    insert into auth.users (id, email, created_at) values
      ('${U(1)}', 'a@x.test', ${ago(0)}), ('${U(2)}', 'b@x.test', ${ago(0)}), ('${U(3)}', 'c@x.test', ${ago(3)}),
      ('${U(4)}', 'd@x.test', ${ago(40)}), ('${U(5)}', 'e@x.test', ${ago(40)}), ('${U(6)}', 'f@x.test', ${ago(40)});
    update public.subscriptions set tier = 'pro', status = 'active', stripe_subscription_id = 'sub_a', trialed_at = ${ago(5)} where user_id = '${U(4)}';
    update public.subscriptions set tier = 'premium', status = 'active', stripe_subscription_id = 'sub_b' where user_id = '${U(5)}';
    update public.subscriptions set tier = 'free', status = 'canceled', stripe_subscription_id = 'sub_c', trialed_at = ${ago(2)} where user_id = '${U(6)}';
  `);
  // Stripe ledger. since = 3 days ago (first event with an amount).
  await db.exec(`
    insert into public.stripe_events (id, type, processed_at, amount_cents, customer) values
      ('e_old', 'invoice.paid', ${ago(10)}, null, null),                 -- before the ledger: a payment, revenue unknown
      ('e_3', 'invoice.paid', ${ago(3)}, 500, 'cus_a'),
      ('e_1a', 'invoice.paid', ${ago(1)}, 1999, 'cus_b'),
      ('e_1b', 'invoice.paid', ${ago(1)}, 0, 'cus_c'),                  -- a $0 trial invoice: not a payment
      ('e_0', 'invoice.paid', ${ago(0)}, 1199, 'cus_a'),
      ('d_2a', 'customer.subscription.deleted', ${ago(2)}, null, null),
      ('d_2b', 'customer.subscription.deleted', ${ago(2)}, null, null),
      ('x_0', 'customer.subscription.updated', ${ago(0)}, null, null);
  `);
});

describe("admin_metrics()", () => {
  it("is service role only", async () => {
    await db.exec("set role authenticated");
    await expect(db.query("select public.admin_metrics(1, 1)")).rejects.toThrow(/permission denied/);
    await db.exec("reset role; set role anon");
    await expect(db.query("select public.admin_metrics(1, 1)")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });

  it("returns 30 UTC days, oldest first, ending today", async () => {
    const m = await metrics();
    expect(m.days).toHaveLength(30);
    expect(m.days.at(-1)!.day).toBe((await db.query<{ d: string }>("select (now() at time zone 'utc')::date::text as d")).rows[0]!.d);
  });

  it("counts sign-ups, trials, payments and churn per day", async () => {
    const m = await metrics();
    expect(m.days.reduce((n, d) => n + d.signups, 0)).toBe(3);   // the 3 users from 40 days ago are outside the window
    expect(dayOf(m, 0).signups).toBe(2);
    expect(dayOf(m, 3).signups).toBe(1);
    expect(dayOf(m, 5).trials).toBe(1);
    expect(dayOf(m, 2).trials).toBe(1);
    expect(dayOf(m, 10).payments).toBe(1);   // unknown amount counts
    expect(dayOf(m, 3).payments).toBe(1);
    expect(dayOf(m, 1).payments).toBe(1);    // the $0 invoice does not
    expect(dayOf(m, 0).payments).toBe(1);
    expect(dayOf(m, 2).churned).toBe(2);
    expect(m.days.reduce((n, d) => n + d.churned, 0)).toBe(2);   // other event types are not churn
  });

  it("revenue is in cents from when the ledger began; earlier days are null, not 0", async () => {
    const m = await metrics();
    expect(dayOf(m, 10).revenue_cents).toBeNull();
    expect(dayOf(m, 4).revenue_cents).toBeNull();
    expect(dayOf(m, 3).revenue_cents).toBe(500);
    expect(dayOf(m, 2).revenue_cents).toBe(0);
    expect(dayOf(m, 1).revenue_cents).toBe(1999);
    expect(dayOf(m, 0).revenue_cents).toBe(1199);
    expect(m.revenue_since).toBe(dayOf(m, 3).day);
  });

  it("paying users and MRR in cents from the prices passed in", async () => {
    const m = await metrics();
    expect(m.paying).toEqual({ pro: 1, premium: 1 });
    expect(m.mrr_cents).toBe(1199 + 1999);
  });

  it("invites are 0 without the invites table, then counted per day once it exists", async () => {
    await db.exec("drop table if exists public.invites cascade");   // F13's migration (20261122000200) creates the real table; this test needs the "not there yet" state first
    expect((await metrics()).days.every((d) => d.invites_sent === 0 && d.invites_verified === 0)).toBe(true);
    await db.exec(`
      create table public.invites (id uuid primary key default gen_random_uuid(), inviter_id uuid, invitee_id uuid unique, code text,
        ip_hash text, email_domain text, status text, created_at timestamptz default now(), verified_at timestamptz);
      insert into public.invites (inviter_id, invitee_id, code, status, created_at, verified_at) values
        ('${U(1)}', '${U(2)}', 'c1', 'verified', ${ago(0)}, ${ago(0)}),
        ('${U(1)}', '${U(3)}', 'c1', 'pending', ${ago(0)}, null),
        ('${U(1)}', '${U(4)}', 'c1', 'verified', ${ago(2)}, ${ago(1)}),
        ('${U(1)}', '${U(5)}', 'c1', 'rejected', ${ago(2)}, null);
    `);
    const m = await metrics();
    expect([dayOf(m, 0).invites_sent, dayOf(m, 2).invites_sent, dayOf(m, 1).invites_sent]).toEqual([2, 2, 0]);
    expect([dayOf(m, 0).invites_verified, dayOf(m, 1).invites_verified, dayOf(m, 2).invites_verified]).toEqual([1, 1, 0]);
  });
});

describe("admin_mrr() (20261127000000): yearly plans at price / 12", () => {
  const mrr = async () => (await db.query<{ m: { mrr_cents: number; paying: { pro: number; premium: number }; yearly: number; unknown_interval: number } }>(
    "select public.admin_mrr(1199, 11999, 1999, 19999) as m")).rows[0]!.m;

  it("is service role only", async () => {
    await db.exec("set role authenticated");
    await expect(db.query("select public.admin_mrr(1, 1, 1, 1)")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });

  it("an unrecorded plan length counts monthly (the old estimate) and is reported", async () => {
    await db.exec(`update public.subscriptions set billing_interval = null`);
    expect(await mrr()).toEqual({ mrr_cents: 1199 + 1999, paying: { pro: 1, premium: 1 }, yearly: 0, unknown_interval: 2 });
  });

  it("a yearly Pro counts 11999 / 12; monthly Premium its monthly price; the canceled one nothing", async () => {
    await db.exec(`update public.subscriptions set billing_interval = 'year' where user_id = '${U(4)}';
      update public.subscriptions set billing_interval = 'month' where user_id = '${U(5)}';
      update public.subscriptions set billing_interval = 'year' where user_id = '${U(6)}';`);   // canceled: not paying
    expect(await mrr()).toEqual({ mrr_cents: Math.round(11999 / 12 + 1999), paying: { pro: 1, premium: 1 }, yearly: 1, unknown_interval: 0 });
  });

  it("only month or year can be stored", async () => {
    await expect(db.exec(`update public.subscriptions set billing_interval = 'week' where user_id = '${U(4)}'`)).rejects.toThrow(/check/);
  });
});
