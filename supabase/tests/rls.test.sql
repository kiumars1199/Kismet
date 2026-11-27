-- pgTAP checks for a real Supabase DB: `supabase test db` (local) or the owner's project.
-- Mirrors apps/web/test/rls.test.ts (which runs the same migrations in PGlite on every `pnpm test`).
begin;
select plan(9);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'every public table has RLS on');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@rls.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@rls.test', 'authenticated', 'authenticated');

select is((select tier from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000a'), 'free',
  'signup trigger creates a free subscription');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.presets (name, query) values ('A view', '{"v":1}');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.presets), 0, 'user B sees none of user A''s presets');
update public.subscriptions set tier = 'premium';
select is((select count(*)::int from public.subscriptions where tier = 'premium'), 0, 'users cannot write their tier');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.profiles), 0, 'anon sees no profiles');

-- F11 bet tracker: user B can't read, change or delete user A's bets, nor write one as A.
-- (journal writes are Pro-only at the policy level, so A's row is seeded as the table owner.)
reset role;
insert into public.journal (user_id, market_id, side_index, price, shares)
  values ('00000000-0000-0000-0000-00000000000a', 'm1', 0, 0.5, 10);
update public.subscriptions set tier = 'pro' where user_id = '00000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.journal), 0, 'user B cannot read user A''s bets');
update public.journal set pnl_usd = 999, result = 'won';
delete from public.journal;
select throws_ok(
  $$insert into public.journal (user_id, market_id, side_index, price, shares)
    values ('00000000-0000-0000-0000-00000000000a', 'm2', 0, 0.5, 1)$$,
  '42501', null, 'user B cannot write a bet as user A');
reset role;
select is((select count(*)::int from public.journal where result is null and pnl_usd is null), 1,
  'user A''s bet is untouched by B''s update and delete');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.journal), 0, 'anon sees no bets');

select * from finish();
rollback;
