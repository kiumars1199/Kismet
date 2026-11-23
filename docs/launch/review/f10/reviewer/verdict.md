# F10 #56 3234b82: PASS with notes
Local (wt at 3234b82, real pnpm i): vitest push-subscribe + pwa + alerts-cron + alerts 36/36; demo build OK (tsc errors were a stale .next from another build only).
Assets 200 with right types: manifest, sw.js, icons 192/512/maskable. Lighthouse 12 (local next start): installable-manifest 1, splash-screen 1,
themed-omnibox 1, maskable-icon 1 (lh.json). LH 12 has no service-worker audit; /sw.js is served and caches/intercepts nothing.
Code: endpoint allow-list (SSRF), 10-device cap, RLS own rows, push only when pushConfigured() (no VAPID in tests -> never sends), "gone" deletes device,
each event pushed at most once (only events inserted this run). CI all green.
Notes: 1) sw.js accepts data.url starting with "/" incl. "//host" -> openWindow("//host") is off-site. Payload is server-built (/m/<id>), so low; use startsWith("/") && !startsWith("//").
2) push_subscriptions.endpoint is globally unique; a second account on the same browser upserts onto the first account's row, RLS refuses -> 500 "Couldn't save this device". Low.
3) Migration 20261122000500 is also in #57 (stacked); #57's 000600 keeps 'settled'. Fine if merged in order.
