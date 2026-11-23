-- F13 invites: a personal invite code per user, one row per sign-up that used it, and the one-time reward.
-- 5 verified sign-ups from a user's link earn 30 days of Premium through the existing admin comp
-- (subscriptions.comp_tier / comp_expires_at, which effectiveTier() honors and which never lowers a paid plan).
-- Additive only. The web app writes with the service role after its self-referral checks (lib/invites/guard.ts);
-- users can only read their own rows (counter on /account). No client insert, update or delete policy exists.

-- ---------------------------------------------------------------- codes
create table public.invite_codes (
  user_id uuid primary key references auth.users on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8}$'),
  ip_hashes text[] not null default '{}',        -- salted hashes of the owner's recent addresses (self-referral check)
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
create policy "own code read" on public.invite_codes for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.invite_codes from anon, authenticated;
grant select (user_id, code, created_at) on public.invite_codes to authenticated;   -- not ip_hashes

-- ---------------------------------------------------------------- sign-ups that used a code
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users on delete cascade,
  invitee_id uuid not null unique references auth.users on delete cascade,   -- an account counts once
  code text not null,
  ip_hash text,                                  -- salted hash (INVITE_IP_SALT); the address itself is never stored
  email_domain text,
  status text not null check (status in ('pending','verified','rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index invites_inviter_idx on public.invites (inviter_id, status);
alter table public.invites enable row level security;
create policy "inviter reads own" on public.invites for select to authenticated
  using (inviter_id = (select auth.uid()));
revoke all on public.invites from anon, authenticated;
grant select (id, inviter_id, status, created_at, verified_at) on public.invites to authenticated;   -- not ip_hash / email_domain

-- ---------------------------------------------------------------- one reward per inviter
create table public.invite_rewards (
  inviter_id uuid primary key references auth.users on delete cascade,
  outcome text not null,                         -- 'granted' (a row exists only once the month was granted)
  comp_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invite_rewards enable row level security;
create policy "own reward read" on public.invite_rewards for select to authenticated
  using (inviter_id = (select auth.uid()));
revoke all on public.invite_rewards from anon, authenticated;
grant select on public.invite_rewards to authenticated;

-- T-280 (20261120000000_oauth_clients_no_tables.sql): an OAuth app's token never reads or writes these tables.
do $$
declare t text;
begin
  foreach t in array array['invite_codes', 'invites', 'invite_rewards'] loop
    execute format('drop policy if exists "no oauth clients" on public.%I', t);
    execute format(
      'create policy "no oauth clients" on public.%I as restrictive for all to anon, authenticated '
      'using ((select auth.jwt() ->> ''client_id'') is null) with check ((select auth.jwt() ->> ''client_id'') is null)', t);
  end loop;
end $$;

-- Grant the reward once the inviter has 5 verified sign-ups AND can take it. Never lowers anything. While the inviter
-- can't take it yet, nothing is recorded, so a later call (their next sign-in, a trial that lapses) still grants:
--   * Premium paid or on trial (active, trialing, past_due): not now (a month on top of Premium they already have is
--     worth nothing), asked again later;
--   * a live comp with no end date: can't be stacked on, asked again later;
--   * a live comp with an end date: Premium until that end + 30 days (stacks);
--   * otherwise (free, or paid Pro): Premium comp for 30 days from now (paid Pro keeps its plan underneath).
-- The invite_rewards row (primary key = inviter) is written only when the month is actually granted, so it can't repeat.
create or replace function public.grant_invite_reward(p_inviter uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  s public.subscriptions;
  live boolean;
  new_end timestamptz;
begin
  select count(*) into n from public.invites where inviter_id = p_inviter and status = 'verified';
  if n < 5 then return jsonb_build_object('granted', false, 'reason', 'below_threshold', 'verified', n); end if;
  if exists (select 1 from public.invite_rewards where inviter_id = p_inviter) then
    return jsonb_build_object('granted', false, 'reason', 'already_rewarded', 'verified', n);
  end if;

  insert into public.subscriptions (user_id) values (p_inviter) on conflict do nothing;
  select * into s from public.subscriptions where user_id = p_inviter for update;
  live := s.comp_tier is not null and (s.comp_expires_at is null or s.comp_expires_at > now());

  if s.tier = 'premium' and coalesce(s.status, 'active') in ('active', 'trialing', 'past_due') then
    return jsonb_build_object('granted', false, 'reason', 'paid_premium', 'verified', n);
  end if;
  if live and s.comp_expires_at is null then
    return jsonb_build_object('granted', false, 'reason', 'open_ended_comp', 'verified', n);
  end if;

  insert into public.invite_rewards (inviter_id, outcome) values (p_inviter, 'granted') on conflict do nothing;
  if not found then return jsonb_build_object('granted', false, 'reason', 'already_rewarded', 'verified', n); end if;
  new_end := (case when live then s.comp_expires_at else now() end) + interval '30 days';
  update public.subscriptions set comp_tier = 'premium', comp_expires_at = new_end where user_id = p_inviter;
  update public.invite_rewards set comp_until = new_end where inviter_id = p_inviter;
  return jsonb_build_object('granted', true, 'comp_until', new_end, 'verified', n);
end;
$$;
revoke all on function public.grant_invite_reward(uuid) from public, anon, authenticated;
grant execute on function public.grant_invite_reward(uuid) to service_role;
