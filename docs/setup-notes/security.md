# Security setup (Lane X)

Owner steps for the controls in `docs/15-security.md`. The evidence map is `docs/SECURITY_EVIDENCE.md`.

## Env vars (Vercel, Production and Preview)

| Var | Needed | What happens without it |
| --- | --- | --- |
| `DEMO_MODE` | Leave unset or set to `false` in production | Unset in production means live mode, which is the safe default. Only the exact value `true` turns demo on. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **Required in production** | Rate limits and the 5,000 rows/hour anomaly log turn off, and each instance logs a warning. Create a free Upstash Redis database and use the REST URL and token. |

## Vercel Firewall (dashboard: Project > Firewall)

The project has no code-level way to set managed rulesets, so set them by hand once:

1. **Bot Management > Bot Protection**: set to **Challenge**. Use **Log** for the first day if you want to watch first.
2. **Bot Management > AI Bots**: set to **Deny**. This duplicates the middleware 403 (`apps/web/lib/bots.ts`) at the edge, before an invocation is billed.
3. **Rules > WAF Managed Rulesets > OWASP Core Ruleset**: turn on and set to Deny. This needs the Enterprise plan; on lower plans, skip it. Input validation in the app (zod `.strict()` on every route) still applies.
4. Click **Review Changes**, then **Publish**.

CLI equivalent (Vercel CLI, run from the linked project):

```bash
vercel firewall rules update bot-protection --action challenge --yes
vercel firewall rules update ai-bots --category ai-crawlers --action deny --yes
vercel firewall publish --confirm-name <project>
```

## Vercel BotID

- On by itself on Vercel. `next.config.ts` wraps the config with `withBotId` only when `VERCEL` is set, and the browser runs `initBotId` for the same routes.
- Protected routes: market and flag lists, market and event detail, suggest, order book, magic-link sign-in, and Stripe checkout. A request that BotID marks as a bot (and not a verified bot) gets 403.
- Off Vercel (local, CI, e2e), `checkBotId()` is not called, so requests pass.
- `/api/events/by-slug/*` is not protected because the Chrome extension calls it, and the extension cannot run the BotID challenge. It is still rate limited.

## Signed URLs

None exist. The browser never fetches data files directly. The server reads the Supabase bucket with the service key, or reads the GitHub `live` branch. Keep the bucket **private**.
