// The topic picker's save queue. A tap changes the picker's own list at once (optimistic); saves go out one at a time and
// each carries the FULL current list, so the last write is always the final UI state, however slow or out of order the
// network is. Without this, every in-flight tap built its list from the same stale snapshot and the last write won
// (3 quick taps saved 1 topic).
//
// The list is `base` (the last confirmed list) with the taps made since laid over it (`ops`, each a toggle). A save sends
// base + the first n taps. If it succeeds those taps become part of base. If it fails only those n taps are dropped and the
// taps made while it was in flight are rebased on the confirmed list and sent next, so a failure never eats a later tap.

export type TopicSaverIO = {
  /** Resolves once the account store is the active one (a tap before AuthBoot's switch would land in the guest store). */
  ready(): Promise<unknown>;
  isReady(): boolean;
  /** The store's current topics (read at the first tap, and again after `ready` for a tap made too early). */
  current(): string[];
  /** Persist the full list. */
  save(next: string[]): Promise<unknown>;
  /** The list the tiles should show now; null = nothing pending, follow the store. */
  onLocal(next: string[] | null): void;
  /** The page is being left: send the full list once, fire-and-forget (keepalive). */
  flush?(list: string[]): void;
  /** A save failed: the topics whose taps were dropped (the tiles already show the confirmed list plus later taps). */
  onError?(dropped: string[], e: unknown): void;
};

const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function createTopicSaver(io: TopicSaverIO) {
  let base: string[] | null = null;   // last confirmed list; null while idle
  let ops: string[] = [];             // taps since base, in order
  let retried = false;                // a network-level failure is retried once before it counts as a failed save
  let frozen = false;                 // the page is being left: the flush owns the final list, so queued saves stand down
  let early = false;                  // base was read before the account store was ready
  let chain: Promise<void> = Promise.resolve();

  const view = () => ops.reduce(flip, base ?? []);

  const run = async () => {
    if (!io.isReady()) {
      await io.ready();
      if (early && ops.length) { base = io.current(); early = false; io.onLocal(view()); }
    }
    if (frozen || !ops.length) return;   // frozen, or an earlier queued save already carried these taps
    const n = ops.length;
    const sent = ops.slice(0, n).reduce(flip, base ?? []);
    try {
      await io.save(sent);
      retried = false;
      base = sent;
      ops = ops.slice(n);
      if (frozen && ops.length) io.flush?.(view());   // this older save may have landed after the flush: send the newest list again
    } catch (e) {
      if (frozen) { if (ops.length) io.flush?.(view()); return; }   // a request cut off by the page leaving is not a failed save: the flush carries the list
      // A request cut off by a navigation rejects just before pagehide fires (fetch TypeError / AbortError, not an HTTP error). Wait a
      // moment: if the page is being left, the flush carries the list; if not, it is a dropped connection and we try once more.
      if (!retried && (e instanceof TypeError || (e as { name?: string })?.name === "AbortError")) {
        retried = true;
        await new Promise((r) => setTimeout(r, 250));
        return run();
      }
      retried = false;
      const dropped = ops.slice(0, n);
      ops = ops.slice(n);
      // roll back only the failed taps: later taps now sit on the confirmed list, and the next queued run sends them
      if (!ops.length) base = null;
      io.onLocal(ops.length ? view() : null);
      io.onError?.([...new Set(dropped)], e);
      return;
    }
    if (!ops.length) { base = null; io.onLocal(null); }   // settled: follow the store again
  };

  return {
    toggle(id: string) {
      if (base === null) { early = !io.isReady(); base = io.current(); ops = []; }
      ops.push(id);
      io.onLocal(view());
      chain = chain.then(run, run);
    },
    /** The full list still unconfirmed (queued or in flight), or null. Used when the page is being left, to send it once more. */
    pending: (): string[] | null => (base !== null && ops.length ? view() : null),
    /** The page is being left: returns the list to send once (keepalive) and stops the queue sending or reverting meanwhile. */
    freeze(): string[] | null { frozen = true; const list = base !== null && ops.length ? view() : null; if (list) io.flush?.(list); return list; },
    /** Send the pending list once now (keepalive) without freezing the queue. */
    flushNow() { const l = base !== null && ops.length ? view() : null; if (l) io.flush?.(l); },
    /** Waits until nothing is unconfirmed (saved, or failed and reverted), at most capMs. true = settled. */
    async settled(capMs: number): Promise<boolean> {
      const end = Date.now() + capMs;
      while (base !== null && ops.length && Date.now() < end) await Promise.race([chain, new Promise((r) => setTimeout(r, 50))]);
      return !(base !== null && ops.length);
    },
    /** The page came back (bfcache, tab visible again): carry on; anything still unconfirmed is sent again as a full list. */
    resume() { if (!frozen) return; frozen = false; if (ops.length) chain = chain.then(run, run); },
    /** For tests: resolves when every queued save has finished. */
    idle: () => chain,
  };
}
