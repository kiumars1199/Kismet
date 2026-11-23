-- F5: remember that a user cleared the "Your topics" pill so Best bets stops opening filtered, on every device.
-- Additive: one boolean on the user's own profile row (own-row RLS already lets them update it).
alter table public.profiles add column if not exists topics_off boolean not null default false;
