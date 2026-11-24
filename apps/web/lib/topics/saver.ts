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
  /** A save failed: the topics whose taps were dropped (the tiles already show the confirmed list plus later taps). */
  onError?(dropped: string[], e: unknown): void;
};

const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function createTopicSaver(io: TopicSaverIO) {
  let base: string[] | null = null;   // last confirmed list; null while idle
  let ops: string[] = [];             // taps since base, in order
  let early = false;                  // base was read before the account store was ready
  let chain: Promise<void> = Promise.resolve();

  const view = () => ops.reduce(flip, base ?? []);

  const run = async () => {
    if (!io.isReady()) {
      await io.ready();
      if (early && ops.length) { base = io.current(); early = false; io.onLocal(view()); }
    }
    if (!ops.length) return;   // an earlier queued save already carried these taps
    const n = ops.length;
    const sent = ops.slice(0, n).reduce(flip, base ?? []);
    try {
      await io.save(sent);
      base = sent;
      ops = ops.slice(n);
    } catch (e) {
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
    /** For tests: resolves when every queued save has finished. */
    idle: () => chain,
  };
}
