"use client";

// Close times on cards and the market page, hydration-safe (audit run 2, 3-a). The server has no idea of the
// visitor's time zone or the exact second the page hydrates, so the first render uses UTC and a "now" floored
// to 10 minutes; after hydration the same component re-renders in local time with the real clock.
import { useSyncExternalStore } from "react";
import { closesLine, gameTime } from "@/lib/format";

const noop = () => () => {};
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function useWhen(closesAt: number | null | undefined) {
  const hydrated = useHydrated();
  const now = hydrated ? Date.now() : Math.floor(Date.now() / 600_000) * 600_000;
  return {
    game: gameTime(closesAt, now, hydrated ? undefined : "UTC"),
    closes: closesLine(closesAt, now),
    Closes: closesLine(closesAt, now, true),
    full: hydrated && closesAt != null ? new Date(closesAt * 1000).toLocaleString() : undefined,
  };
}
