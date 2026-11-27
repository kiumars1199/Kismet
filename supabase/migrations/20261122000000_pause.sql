-- F8: self-pause. profiles.paused_until is set only by the server (service role, POST /api/account/pause); while it is
-- in the future the app shows only the pause screen and data routes answer 423. A user can't set, shorten or clear it
-- with their own JWT. Additive. Until applied the app reads no pause (the column read fails soft).

alter table public.profiles add column if not exists paused_until timestamptz;

create or replace function public.guard_profile_server_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (
    new.accepted_terms_at is distinct from old.accepted_terms_at or new.created_at is distinct from old.created_at
    or new.first_bets_at is distinct from old.first_bets_at
    or new.paused_until is distinct from old.paused_until
  ) then
    raise exception 'accepted_terms_at, created_at, first_bets_at and paused_until are set by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;
