// Data freshness (F-24): fresh until 3 h, amber until 6 h, red ("data may be stale") after.
// One threshold for every stale notice (pill, banner, status): the banner shows when this is not "fresh".
export type Freshness = "fresh" | "amber" | "red";

/** How often prices refresh, in words, for copy. The engine host scans every SCAN_EVERY_SEC (ops/scheduler.py, 120 s
 *  by default); without it the GitHub fallback scans every 30 min (.github/workflows/refresh.yml). Quote the slower
 *  one so the copy stays true either way; both stay well inside the 3 h "fresh" window, so no stale notice shows
 *  while either runs. */
export const REFRESH_WORDS = "at least every 30 minutes";

export function freshness(scannedAt: number | null | undefined, now = Date.now()): Freshness {
  if (typeof scannedAt !== "number" || !Number.isFinite(scannedAt)) return "red";
  const h = (now - scannedAt * 1000) / 3_600_000;
  return h > 6 ? "red" : h > 3 ? "amber" : "fresh";
}

/** Minutes until the next GitHub Actions full run (.github/workflows/refresh.yml: "17 *\/2 * * *" UTC). Scans run
 *  more often than that (see REFRESH_WORDS), so the UI no longer quotes this as "next scan". */
export function nextScanMin(now = Date.now()): number {
  const d = new Date(now);
  const sinceSlot = ((d.getUTCHours() % 2) * 60 + d.getUTCMinutes() - 17 + 120) % 120;   // minutes past the last :17 slot
  return Math.max(1, 120 - sinceSlot - (d.getUTCSeconds() > 0 ? 1 : 0));
}
/** "6 min", "1 h 20 min" */
export const nextScanIn = (now = Date.now()) => {
  const m = nextScanMin(now);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
};
