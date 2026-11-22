// F8 self-pause (docs/launch/SPEC.md). Pure: lengths, the end time, and the 423 body. No Node or Next imports.
export const PAUSE_OPTIONS = [
  { key: "24h", hours: 24, label: "24 hours" },
  { key: "7d", hours: 24 * 7, label: "7 days" },
  { key: "30d", hours: 24 * 30, label: "30 days" },
] as const;
export type PauseKey = (typeof PAUSE_OPTIONS)[number]["key"];
export const PAUSE_KEYS = PAUSE_OPTIONS.map((o) => o.key) as [PauseKey, ...PauseKey[]];

/** The pause is on while its end is in the future. */
export const isPaused = (until: string | null | undefined, now = Date.now()): boolean => {
  const t = until ? Date.parse(until) : NaN;
  return Number.isFinite(t) && t > now;
};

/** End of a new pause started at `now`. An active pause is never shortened: the later end wins. */
export function pauseEnd(key: PauseKey, now: number, current?: string | null): string {
  const hours = PAUSE_OPTIONS.find((o) => o.key === key)!.hours;
  const next = now + hours * 3_600_000;
  const cur = isPaused(current, now) ? Date.parse(current!) : 0;
  return new Date(Math.max(next, cur)).toISOString();
}

/** Body of the 423 that data routes return while paused. */
export const pausedBody = (until: string) => ({ error: "Your account is paused", code: "paused", until });

/** The 423 Response for a paused account, else null. */
export function pausedResponse(me: { paused_until?: string | null }, now = Date.now()): Response | null {
  return isPaused(me.paused_until, now)
    ? Response.json(pausedBody(me.paused_until!), { status: 423, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } })
    : null;
}
