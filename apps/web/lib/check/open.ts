// F1/F2: a market whose closes_at has passed is not a bet any more: no score, no combo leg. Same rule as the lists
// (lib/filters/apply.ts openOnly / nowFor), so DATA_CLOCK=scan keeps fixture markets open in tests.
import { nowFor } from "@/lib/filters/apply";
import type { Store } from "@/lib/data/store";

export const isOpen = (m: { closes_at: number }, now: number): boolean => m.closes_at > now;
export const isOpenIn = (m: { closes_at: number }, store: Pick<Store, "meta">): boolean => isOpen(m, nowFor(store));
export const NOT_OPEN = "We couldn't find an open market at that link";
