-- F16: a "big_trade" alert rule kind (Premium: one trade of $10,000+ on a market the user follows).
-- Widens the kind check only (adds to the list from 20261122000500); no data changes, RLS unchanged.
alter table public.alert_rules drop constraint if exists alert_rules_kind_check;
alter table public.alert_rules add constraint alert_rules_kind_check
  check (kind in ('preset_match','market_price','edge_change','closing_soon','settled','big_trade'));
