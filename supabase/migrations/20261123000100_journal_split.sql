-- F11: a Polymarket market that resolves 50/50 pays $0.50 a share, which is not a refund. Journal rows get their own
-- result, 'split'. Additive: only widens the allowed values; existing rows and policies are unchanged.
alter table public.journal drop constraint if exists journal_result_check;
alter table public.journal add constraint journal_result_check check (result in ('won','lost','void','split'));
