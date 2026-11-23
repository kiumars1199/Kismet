// F14: output/history.json (price history per flag row), server only. Own 120 s cache, concurrent loads de-duplicated.
// Missing, unreadable or malformed = undefined = "no history": a chart's empty state, never an error.
import type { HistoryFile } from "@/lib/types";
import { readSource } from "./store";

const TTL_MS = 120_000;

export function parseHistory(text: string | undefined): HistoryFile | undefined {
  if (text === undefined) return undefined;
  try {
    const f = JSON.parse(text) as HistoryFile;
    return f && typeof f === "object" && f.series && typeof f.series === "object" ? f : undefined;
  } catch {
    return undefined;
  }
}

const cache: { at?: number; data?: HistoryFile; inflight?: Promise<HistoryFile | undefined> } = {};
export function getHistory(): Promise<HistoryFile | undefined> {
  if (cache.at && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.data);
  return (cache.inflight ??= readSource("history.json")
    .then((text) => (cache.data = parseHistory(text)))
    .catch((e) => { console.warn(`[store] history.json failed: ${(e as Error).message}`); return cache.data; })
    .finally(() => { cache.at = Date.now(); cache.inflight = undefined; }));
}
