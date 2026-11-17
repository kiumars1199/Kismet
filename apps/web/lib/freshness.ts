// Data freshness (F-24): fresh until 3 h, amber until 6 h, red ("data may be stale") after.
export type Freshness = "fresh" | "amber" | "red";

export function freshness(scannedAt: number | null | undefined, now = Date.now()): Freshness {
  if (typeof scannedAt !== "number" || !Number.isFinite(scannedAt)) return "red";
  const h = (now - scannedAt * 1000) / 3_600_000;
  return h > 6 ? "red" : h > 3 ? "amber" : "fresh";
}
