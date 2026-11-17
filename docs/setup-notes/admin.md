# Admin dashboard (Lane AD, T-140 to T-143)

`/admin` is the owners' console: users, comps, site settings, system health and an audit log.

## 1. Who is an admin

Set `ADMIN_EMAILS` in Vercel (Project → Settings → Environment Variables, Production and Preview):

```
ADMIN_EMAILS=marcyamin10@gmail.com,kiumarsmomtaz@gmail.com
```

- Comma-separated. Compared lowercase, exact match. Not a secret, but server-only (no `NEXT_PUBLIC_`).
- Empty or unset means **no admins**.
- You are an admin only when signed in through Supabase with a **verified** email in the list. Demo mode never grants admin.
- To remove an admin, edit the variable and redeploy. The panel has no way to grant or remove admin access.
- Everyone else (signed out or not on the list) gets a plain 404 on `/admin` and on `/api/admin/*`.

## 2. Apply the migration

Run `supabase/migrations/20261118000000_admin.sql` (Supabase → SQL editor, or `supabase db push`). It adds:

- `subscriptions.comp_tier` / `comp_expires_at`: free comps the entitlements honor (the higher of paid tier and an unexpired comp).
- `admin_audit_log`: append-only (a trigger blocks update and delete), RLS on, no access for `anon` or `authenticated`.
- `app_settings`: key/value site settings, RLS on, service role only.
- `admin_overview`, `admin_users`, `admin_user_detail`, `admin_revoke_sessions`: security-definer functions callable only by the service role.

Until the migration runs, `/admin` pages show errors; the rest of the site keeps working with default settings.

## 3. Site settings (`/admin/settings`)

Every save is validated, written to `app_settings` and to the audit log. The server reads settings through a cache: the
instance that saved sees the change at once; other instances within 60 seconds. Maintenance mode is read at the edge
with a 30-second cache.

| Setting | What it does | Default |
|---|---|---|
| Announcement banner + text | A one-line banner above the header on every page, for everyone. Plain text, 280 characters. | off |
| Maintenance mode | Everyone except admins sees a "Down for maintenance" page (HTTP 503); `/api/*` answers 503 with `Retry-After`. Sign-in, `/api/me` and `/api/health` stay open so admins can get in. | off |
| Sign-ups open | When closed, magic links go only to existing accounts, and a brand-new Google sign-in is removed again and sent back to the login page. Admin emails can always sign up. For a hard stop, also turn off "Allow new users to sign up" in Supabase → Authentication. | open |
| Free rows | Rows a Free user gets per request. The server still trims every response to this cap. | 25 |
| Free delay | Minutes Free data runs behind live. | 15 |
| Paper-trading allowlist | Emails allowed to paper-trade, added to `TRADING_ALLOWLIST`. Trading still needs `KALSHI_TRADING_ENV`. | empty |
| Alert sending | Kill switch for the alerts cron. When off, the cron runs but sends nothing. | on |

## 4. User actions (`/admin/users/<id>`)

- **Comp a tier** (Pro or Premium) with an optional expiry, or remove the comp. A comp never lowers a paid tier.
- **Email a sign-in link** (needs `RESEND_API_KEY`). The link is never shown in the browser.
- **Sign out everywhere** and **Delete user** need the user's email typed to confirm. Delete cancels the Stripe
  subscription first. Admins can't run either on their own account. Access tokens already issued stay valid until
  they expire (up to 1 hour); refresh tokens are gone at once.
- **Refunds**: use the Stripe dashboard link on the user page. The panel doesn't refund.

## 5. Other

- **CSV export** (Users → Export CSV): every user's email, tier and dates. Audited. Cells are escaped against formula injection.
- **System health**: data freshness, engine record, which services are configured (yes/no only, never values), the last
  alert run and the last 50 Stripe events.
- Admin mutations are rate-limited to 30 a minute per admin and checked for same-origin, like every other mutation.
