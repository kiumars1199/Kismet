-- F15: admin metrics for the last 30 UTC days. Additive. admin_overview() is untouched.
--  * stripe_events gets the revenue ledger: amount_cents (what an invoice.paid brought in) and customer. The webhook fills
--    them from now on; earlier events keep null, and the admin shows "—" for those days, never $0.
--  * admin_metrics(pro_cents, premium_cents): service role only, like the other admin_* functions. The prices come from
--    config/site.json (the database has none). All money is in cents here.
-- Invites come from public.invites (F13) when that table exists; until then they are 0.

alter table public.stripe_events add column if not exists amount_cents bigint check (amount_cents is null or amount_cents >= 0);
alter table public.stripe_events add column if not exists customer text;
create index if not exists stripe_events_type_processed_idx on public.stripe_events (type, processed_at);

create or replace function public.admin_metrics(pro_cents int, premium_cents int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
  since date;
  inv_sent jsonb := '{}'::jsonb;
  inv_ok jsonb := '{}'::jsonb;
  from_ts timestamp := date_trunc('day', now() at time zone 'utc') - interval '29 days';
begin
  select min(processed_at at time zone 'utc')::date into since from public.stripe_events where amount_cents is not null;

  if to_regclass('public.invites') is not null then
    execute $q$select coalesce(jsonb_object_agg(d::text, n), '{}'::jsonb) from (
        select (created_at at time zone 'utc')::date d, count(*) n from public.invites
        where (created_at at time zone 'utc') >= $1 group by 1) s$q$ into inv_sent using from_ts;
    execute $q$select coalesce(jsonb_object_agg(d::text, n), '{}'::jsonb) from (
        select (verified_at at time zone 'utc')::date d, count(*) n from public.invites
        where status = 'verified' and (verified_at at time zone 'utc') >= $1 group by 1) s$q$ into inv_ok using from_ts;
  end if;

  select jsonb_build_object(
    'days', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', d::date,
        'signups', (select count(*) from auth.users u where (u.created_at at time zone 'utc') >= d and (u.created_at at time zone 'utc') < d + interval '1 day'),
        'trials', (select count(*) from public.subscriptions s where (s.trialed_at at time zone 'utc') >= d and (s.trialed_at at time zone 'utc') < d + interval '1 day'),
        'payments', (select count(*) from public.stripe_events e where e.type = 'invoice.paid' and coalesce(e.amount_cents, 1) > 0
          and (e.processed_at at time zone 'utc') >= d and (e.processed_at at time zone 'utc') < d + interval '1 day'),
        'revenue_cents', case when since is null or d::date < since then null else
          (select coalesce(sum(e.amount_cents), 0) from public.stripe_events e where e.type = 'invoice.paid'
            and (e.processed_at at time zone 'utc') >= d and (e.processed_at at time zone 'utc') < d + interval '1 day') end,
        'churned', (select count(*) from public.stripe_events e where e.type = 'customer.subscription.deleted'
          and (e.processed_at at time zone 'utc') >= d and (e.processed_at at time zone 'utc') < d + interval '1 day'),
        'invites_sent', coalesce((inv_sent ->> d::date::text)::int, 0),
        'invites_verified', coalesce((inv_ok ->> d::date::text)::int, 0)
      ) order by d), '[]'::jsonb)
      from generate_series(from_ts, date_trunc('day', now() at time zone 'utc'), interval '1 day') d),
    'revenue_since', since,
    'paying', (select jsonb_build_object(
        'pro', count(*) filter (where tier = 'pro'),
        'premium', count(*) filter (where tier = 'premium'))
      from public.subscriptions where status in ('active','past_due') and stripe_subscription_id is not null),
    'mrr_cents', (select coalesce(count(*) filter (where tier = 'pro'), 0) * pro_cents::bigint
        + coalesce(count(*) filter (where tier = 'premium'), 0) * premium_cents::bigint
      from public.subscriptions where status in ('active','past_due') and stripe_subscription_id is not null)
  ) into r;
  return r;
end;
$$;

revoke execute on function public.admin_metrics(int, int) from public, anon, authenticated;
grant execute on function public.admin_metrics(int, int) to service_role;
