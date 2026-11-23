-- F12 (morning digest): explicit opt-in (default off) and a once-a-day claim so a user is never emailed twice in a day.
-- Additive. The opt-in is written by /api/digest/optin and /api/unsubscribe (service role); applied by the lead.
alter table public.profiles add column if not exists digest_opt_in boolean not null default false;

create table if not exists public.digest_emails (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.digest_emails enable row level security;
revoke all on public.digest_emails from anon, authenticated;
drop policy if exists "no oauth clients" on public.digest_emails;
create policy "no oauth clients" on public.digest_emails as restrictive for all to anon, authenticated
  using ((select auth.jwt() ->> 'client_id') is null) with check ((select auth.jwt() ->> 'client_id') is null);
