-- F10 review: a second account signing in on the same browser could not turn phone alerts on, because
-- push_subscriptions.endpoint is unique across users and RLS hides the first account's row.
-- This function moves that row to p_user, and only when the caller sends the same endpoint AND the same keys
-- (p256dh + auth), which only the browser holding the subscription knows. Knowing an endpoint alone is not
-- enough. p_user's device cap (10, MAX_DEVICES in apps/web/lib/alerts-push-store.ts) is enforced here too.
-- Service role only, like every other security definer function here: POST /api/push/subscribe calls it for the
-- signed-in user after its own checks (tier, body). Additive: one new function, no table or policy changes.
create or replace function public.claim_push_subscription(p_user uuid, p_endpoint text, p_keys jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved int;
begin
  if p_user is null or p_endpoint is null or p_keys is null
     or coalesce(p_keys->>'p256dh', '') = '' or coalesce(p_keys->>'auth', '') = '' then
    return false;
  end if;
  if (select count(*) from public.push_subscriptions where user_id = p_user) >= 10 then
    return false;
  end if;
  update public.push_subscriptions
     set user_id = p_user, created_at = now()
   where endpoint = p_endpoint
     and keys->>'p256dh' = p_keys->>'p256dh'
     and keys->>'auth' = p_keys->>'auth';
  get diagnostics moved = row_count;
  return moved > 0;
end;
$$;
revoke execute on function public.claim_push_subscription(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_push_subscription(uuid, text, jsonb) to service_role;
