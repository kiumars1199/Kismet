-- F10: a "settled" alert rule kind (push/in-app/email when a market the user has a rule on resolves).
-- Widens the kind check only; no data changes, existing rows stay valid. RLS on alert_rules is unchanged.
-- (push_subscriptions already exists in 20261117000000_init.sql with RLS: own rows only.)
alter table public.alert_rules drop constraint if exists alert_rules_kind_check;
alter table public.alert_rules add constraint alert_rules_kind_check
  check (kind in ('preset_match','market_price','edge_change','closing_soon','settled'));
