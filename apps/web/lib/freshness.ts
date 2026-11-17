// Data freshness (F-24): fresh until 3 h, amber until 6 h, red ("data may be stale") after.
export type Freshness = "fresh" | "amber" | "red";

export function freshness(scannedAt: number | null | undefined, now = Date.now()): Freshness {
  if (typeof scannedAt !== "number" || !Number.isFinite(scannedAt)) return "red";
  const h = (now - scannedAt * 1000) / 3_600_000;
  return h > 6 ? "red" : h > 3 ? "amber" : "fresh";
}

/** Minutes until the next scheduled scan. Keep in step with .github/workflows/refresh.yml: "17 *\/2 * * *" (UTC). */
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
