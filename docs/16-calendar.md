# 16 · Calendar integration

## Decision: subscription feed + one-click "Add to calendar". No Google OAuth.
How it works for users: one link they add once, and their calendar shows when the bets they care about close
(game times, weather days), plus one-click adds for single markets.

Why not connect to Google Calendar with OAuth: reading or writing Google Calendar events uses **sensitive
scopes**, which need Google's verification before any Google account can grant access (typically 3–5
business days plus a demo video), and we'd be storing calendar tokens. A feed needs none of that, works in
Google, Apple and Outlook calendars, and nothing to break.
Trade-off: Google refreshes subscribed feeds on its own schedule (hours, sometimes up to ~24 h); Apple lets
the user pick the interval. So the feed only carries things that don't change often (closing times), never
live prices. Fast things go through alerts (docs/05 F-11).

## Feature 1: personal calendar feed (Pro+)
- `/account` → Calendar: "Add MarketEdge to your calendar" with buttons:
  - **Google Calendar**: `https://calendar.google.com/calendar/render?cid=<webcal URL>`
  - **Apple Calendar**: `webcal://<domain>/cal/<token>.ics`
  - **Outlook**: `https://outlook.live.com/calendar/0/addfromweb?url=<https URL>&name=MarketEdge`
  - **Copy link** (for anything else)
- Feed URL: `https://<domain>/cal/<token>.ics`. Token = 32 random bytes (base64url), stored hashed, revocable
  ("Reset link"), one per user. The feed never includes the user's email.
- What's in it (user picks, saved in `profiles.calendar_prefs`):
  - ☑ Markets on My list: event at close time ("Closes: Denmark vs. Norway — Both Teams to Score")
  - ☑ My bets: event at the market's close ("Your bet resolves: …")
  - ☐ Best bets in my favorite topics closing in the next 48 h (max 20)
  - Reminder alarm (VALARM): none / 15 min / 1 h before
- Event shape (RFC 5545):
  ```
  BEGIN:VEVENT
  UID:<market_id>-<kind>@marketedge.app        (stable, so updates replace instead of duplicating)
  DTSTAMP / DTSTART (UTC) / DTEND (DTSTART+15m)
  SUMMARY:Closes · Denmark vs. Norway: Both Teams to Score
  DESCRIPTION:Saved on MarketEdge. Open: https://<domain>/m/<id>  (no prices: they'd be stale)
  URL:https://<domain>/m/<id>
  CATEGORIES:MarketEdge,Soccer
  STATUS:CANCELLED   (if the market closed early or was removed — keeps calendars clean)
  END:VEVENT
  ```
  Calendar headers: `X-WR-CALNAME:MarketEdge`, `REFRESH-INTERVAL;VALUE=DURATION:PT1H`, `X-PUBLISHED-TTL:PT1H`
  (Apple/Outlook honor these; Google ignores them).
- Route: `GET /cal/[token].ics` → lookup by hash → build from DB (My list, My bets) + store (closing times) →
  `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: private, max-age=900`. Rate limit 60/hour/token.
  Use the `ics` npm package or a 60-line hand-rolled writer with proper line folding (75 octets) and escaping.
- Tests: validates with an iCalendar parser (`node-ical`), UID stability, cancelled events, timezone = UTC.

## Feature 2: "Add to calendar" on any market (Free)
In the drawer's action row, menu with: Google (template link
`https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=<start>/<end>&details=…`),
Outlook web link, and **Download .ics** (single-event file from `/api/markets/[id]/ics`).

## Feature 3 (later, only if users ask): true two-way Google sync via OAuth with the narrowest scope
(`calendar.events.owned` or `calendar.app.created`) after Google verification. Not in this build.
