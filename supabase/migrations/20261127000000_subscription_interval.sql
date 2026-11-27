-- F15 follow-up: MRR counted a yearly plan at the monthly list price. Additive; nothing is dropped or rewritten.
--  * subscriptions.billing_interval: 'month' or 'year', from the Stripe price on the subscription. The webhook fills it
--    from now on (every customer.subscription.* event, including each renewal); existing rows stay null until their next
--    event, and admin_mrr() counts a null as monthly, as the old estimate did, and reports how many it guessed.
--  * admin_mrr(...): one MRR for /admin, in cents. A yearly subscriber counts as its yearly price / 12. Service role
--    only, like the other admin_* functions. The prices come from config/site.json (the database has none).
-- Only the service role writes subscriptions (20261117000000_init.sql), so users can't set this column.

alter table public.subscriptions add column if not exists billing_interval text
  check (billing_interval is null or billing_interval in ('month', 'year'));

create or replace function public.admin_mrr(pro_month_cents int, pro_year_cents int, premium_month_cents int, premium_year_cents int)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mrr_cents', coalesce(round(sum(case
        when tier = 'pro' and billing_interval = 'year' then pro_year_cents / 12.0
        when tier = 'pro' then pro_month_cents
        when tier = 'premium' and billing_interval = 'year' then premium_year_cents / 12.0
        when tier = 'premium' then premium_month_cents
        else 0 end)), 0)::bigint,
    'paying', jsonb_build_object(
      'pro', count(*) filter (where tier = 'pro'),
      'premium', count(*) filter (where tier = 'premium')),
    'yearly', count(*) filter (where billing_interval = 'year' and tier in ('pro', 'premium')),
    'unknown_interval', count(*) filter (where billing_interval is null and tier in ('pro', 'premium')))
  from public.subscriptions
  where status in ('active', 'past_due') and stripe_subscription_id is not null;
$$;

revoke execute on function public.admin_mrr(int, int, int, int) from public, anon, authenticated;
grant execute on function public.admin_mrr(int, int, int, int) to service_role;
