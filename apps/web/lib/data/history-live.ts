// F14: a price history for a market the engine's history.json does not hold (anything but Best bets rows), fetched live from
// Polymarket's public CLOB the first time its drawer opens. Server only. Limits: <= 200 points, <= 90 days (downsample),
// a 10-minute in-memory LRU, one request in flight per market, a 3 s timeout, and the /api/markets rate limit on the route.
// Caches the RAW points (<= ~700 at 60 min over 90 days): the route cuts them at the tier's scan time and THEN downsamples, so
// a delayed tier never gets a bucket carrying a price from after its cut. A failure is not cached for long.
export interface RawPoint { t: number; p: number }

const CLOB = "https://clob.polymarket.com/prices-history";
const TTL_MS = 10 * 60_000;
const FAIL_TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const TIMEOUT_MS = 3000;

type Entry = { at: number; ttl: number; series: RawPoint[] | null };
const cache = new Map<string, Entry>();   // insertion order = least recently used first
const inflight = new Map<string, Promise<RawPoint[] | null>>();

async function clob(token: string, params: Record<string, string>): Promise<{ t: number; p: number }[]> {
  const res = await fetch(`${CLOB}?${new URLSearchParams({ market: token, fidelity: "60", ...params })}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`clob ${res.status}`);
  const body = (await res.json()) as { history?: { t: number; p: number }[] };
  return body.history ?? [];
}

/** interval=max returns nothing at 60 min fidelity for some older markets; then the last 14 days (the CLOB's window cap). */
async function load(token: string, now: number): Promise<RawPoint[] | null> {
  let pts = await clob(token, { interval: "max" });
  if (pts.length < 2) pts = await clob(token, { startTs: String(now - 14 * 86400), endTs: String(now) });
  return pts.length ? pts : null;
}

/** The market's raw points for `token`, or null when there are none (no token, fetch failed or timed out, no data). Never throws. */
export async function liveHistory(token: string | undefined, side: 0 | 1, now = Math.floor(Date.now() / 1000)): Promise<RawPoint[] | null> {
  if (!token || process.env.HISTORY_LIVE === "off") return null;   // off: e2e runs, which must not call the live CLOB
  const key = `${token}:${side}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) {
    cache.delete(key); cache.set(key, hit);
    return hit.series;
  }
  let p = inflight.get(key);
  if (!p) {
    p = load(token, now)
      .then((series) => ({ series, ttl: TTL_MS }), () => ({ series: null, ttl: FAIL_TTL_MS }))
      .then(({ series, ttl }) => {
        cache.set(key, { at: Date.now(), ttl, series });
        while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
        return series;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

export const _resetForTests = () => { cache.clear(); inflight.clear(); };
