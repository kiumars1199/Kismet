// The topic picker's save queue. A tap changes the picker's own list at once (optimistic); saves go out one at a time and
// each carries the FULL current list, so the last write is always the final UI state, however slow or out of order the
// network is. Without this, every in-flight tap built its list from the same stale snapshot and the last write won
// (3 quick taps saved 1 topic). A failed save drops the optimistic list so the tiles show the last confirmed one.

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
  onError?(e: unknown): void;
};

const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const key = (l: string[]) => JSON.stringify(l);

export function createTopicSaver(io: TopicSaverIO) {
  let latest: string[] | null = null;   // what the user has chosen, not yet confirmed
  let taps: string[] = [];              // taps made before the account store was ready, replayed on its list
  let early = false;
  let sent: string | null = null;       // the last list we asked the server to save
  let chain: Promise<void> = Promise.resolve();

  const run = async () => {
    if (!io.isReady()) {
      await io.ready();
      if (early && latest) { latest = taps.reduce(flip, io.current()); taps = []; early = false; io.onLocal(latest); }
    }
    if (latest === null || key(latest) === sent) return;   // an earlier queued save already carried this list
    const next = latest;
    sent = key(next);
    try {
      await io.save(next);
      if (latest !== null && key(latest) === key(next)) { latest = null; sent = null; io.onLocal(null); }   // settled: follow the store again
    } catch (e) {
      latest = null; sent = null; taps = []; early = false;
      io.onLocal(null);
      io.onError?.(e);
    }
  };

  return {
    toggle(id: string) {
      if (latest === null) { early = !io.isReady(); taps = []; }
      latest = flip(latest ?? io.current(), id);
      if (early) taps.push(id);
      io.onLocal(latest);
      chain = chain.then(run, run);
    },
    /** For tests: resolves when every queued save has finished. */
    idle: () => chain,
  };
}
