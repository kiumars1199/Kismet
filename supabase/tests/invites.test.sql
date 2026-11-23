-- pgTAP checks for the F13 invite tables: `supabase test db`. Mirrors apps/web/test/invites-sql.test.ts (PGlite).
begin;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@inv.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@inv.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@inv.test', 'authenticated', 'authenticated');
insert into public.invite_codes (user_id, code) values ('00000000-0000-0000-0000-00000000000a', 'aaaa1111');
insert into public.invites (inviter_id, invitee_id, code, status)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'aaaa1111', 'verified');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.invites), 1, 'the inviter sees their own invite row');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.invites), 0, 'user B cannot read user A''s invite rows');
select is((select count(*)::int from public.invite_codes), 0, 'user B cannot read user A''s code');

select throws_ok(
  $$insert into public.invites (inviter_id, invitee_id, code, status)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'x', 'verified')$$,
  null, null, 'clients cannot insert invite rows');
select throws_ok($$select public.grant_invite_reward('00000000-0000-0000-0000-00000000000b')$$,
  null, null, 'clients cannot call grant_invite_reward');

select * from finish();
rollback;
