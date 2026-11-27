// F8 self-pause, as the extension sees it: the Kismet API answers 423 {code:"paused", until} for a paused account.

/** The pause end time from a 423 paused response, else null. */
export function pausedUntil(r: { status: number; body: unknown }): string | null {
  const b = r.body as { code?: unknown; until?: unknown } | null;
  return r.status === 423 && b?.code === "paused" && typeof b.until === "string" && Number.isFinite(Date.parse(b.until)) ? b.until : null;
}

/** The line the popup shows while a pause is on, or null once it has ended. */
export function pauseLine(until: string | null | undefined, now = Date.now()): string | null {
  const t = until ? Date.parse(until) : NaN;
  if (!Number.isFinite(t) || t <= now) return null;
  const day = new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Your account is paused until ${day}. Kismet is off in the meantime.`;
}
