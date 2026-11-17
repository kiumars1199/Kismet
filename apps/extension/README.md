# MarketEdge for Polymarket (Chrome MV3 extension)

Shows MarketEdge analytics next to Polymarket outcomes. It reads only the page URL slug; every number
comes from the MarketEdge API (`GET /api/events/by-slug/<slug>`). Demo mode talks to `http://localhost:3000`
with no sign-in, tier Premium.

## Build and load unpacked

1. Start the web app (serves real data from `../../output`):
   `cd apps/web && pnpm i && pnpm dev`
2. Install the extension's dependencies:
   `cd apps/extension && pnpm i`
3. Build it into `apps/extension/dist`:
   `pnpm build`
4. Open the extensions page in Chrome:
   `open -a "Google Chrome" chrome://extensions` (or type `chrome://extensions` in the address bar)
5. Turn on **Developer mode** (top right), click **Load unpacked**, pick `apps/extension/dist`.
6. Open a Polymarket event, for example
   `open -a "Google Chrome" https://polymarket.com/event/highest-temperature-in-chicago-on-november-17-2026`

After a rebuild, click the reload icon on the extension's card in `chrome://extensions`.

## Checks

- `pnpm typecheck`
- `pnpm test` (vitest: the text matcher in `src/match.ts`)

## How it works

- `src/background.ts` service worker: API calls with a 60 s cache per slug (`chrome.storage.session`), opens the side panel.
- `src/content.ts` reads the slug (last path segment; sports events redirect to `/sports/<league>/<slug>`),
  matches market labels to page text (`src/match.ts`), mounts one badge per matched market in a shadow root.
  When nothing matches on a page that has markets, it shows a floating pill that opens the side panel list.
- `sidepanel.html` / `src/sidepanel.ts`: one market (both sides, bars, price check, "Details for pros") or the page's list.
- `popup.html` / `src/popup.ts`: connection status, last scan, plan, "Open MarketEdge", disclaimer.
