// F14: the TypeScript twin of engine/history.py downsample(): raw CLOB points -> at most 200 points, at most 90 days, the
// step a whole number of hours, empty buckets carrying the previous price, first and last price exact.
import type { HistorySeries } from "@/lib/types";

export const MAX_POINTS = 200;
export const MAX_DAYS = 90;
const BASE_S = 3600;

export function downsample(raw: { t: number; p: number }[], now: number, side: 0 | 1): HistorySeries | null {
  const pts = raw.filter((x) => Number.isFinite(x.t) && Number.isFinite(x.p) && x.t >= now - MAX_DAYS * 86400 && x.t <= now && x.p >= 0 && x.p <= 1).sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  const t0 = pts[0]!.t;
  const span = pts.at(-1)!.t - t0;
  const dt = BASE_S * Math.max(1, Math.ceil(span / (MAX_POINTS - 1) / BASE_S));
  const out: (number | null)[] = new Array(Math.floor(span / dt) + 1).fill(null);
  for (const x of pts) out[Math.floor((x.t - t0) / dt)] = Math.round(x.p * 1000);
  out[0] = Math.round(pts[0]!.p * 1000);
  let last = out[0] as number;
  const p = out.map((v) => (v === null ? last : (last = v)));
  return { side, t0: Math.round(t0), dt, p };
}
