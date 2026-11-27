// Signed-in user data (docs/03 §3) behind the same Repo interface as LocalRepo. Talks to /api/data,
// which reads and writes Supabase as the user (RLS) with HttpOnly session cookies; no Supabase client here.
import {
  DEFAULT_PROFILE, UniqueViolation,
  type CollectionName, type Collections, type Insert, type Patch, type Profile, type Repo, type Table,
} from "./types";

type Fetch = typeof fetch;
const NAMES: CollectionName[] = ["presets", "dashboards", "watchlist", "alert_rules", "alert_events", "journal"];

/** 403 with { upgrade: true }: the plan's quota is used up (server-enforced). */
export class QuotaExceeded extends Error {
  readonly code = "quota_exceeded";
}

export class SupabaseRepo implements Repo {
  private data = new Map<CollectionName, unknown[]>();
  private profileRow: Profile = DEFAULT_PROFILE;
  private listeners = new Set<() => void>();

  constructor(private base = "/api/data", private fetcher: Fetch = (...a) => fetch(...a)) {}

  /** Load everything once (one request). */
  async load(): Promise<this> {
    const all = (await this.call("GET", "")) as Record<string, unknown> & { profile: Profile };
    for (const n of NAMES) this.data.set(n, (all[n] as unknown[]) ?? []);
    this.confirmed = { ...DEFAULT_PROFILE, ...all.profile };
    this.profileRow = this.confirmed;
    this.recompute();
    this.emit();
    return this;
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await this.fetcher(this.base + path, {
      method, credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => null);
    if (res.status === 409) throw new UniqueViolation(path.split("/")[1] ?? "row");
    if (res.status === 403 && json?.upgrade) throw new QuotaExceeded(json.error ?? "Plan limit reached");
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    return json;
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  };
  private emit() { for (const cb of this.listeners) cb(); }

  snapshot<K extends CollectionName>(name: K): Collections[K][] {
    let v = this.data.get(name);
    if (!v) this.data.set(name, (v = []));
    return v as Collections[K][];
  }
  profileSnapshot(): Profile { return this.profileRow; }

  private set(name: CollectionName, rows: unknown[]) { this.data.set(name, rows); this.emit(); }

  private table<K extends CollectionName>(name: K): Table<Collections[K]> {
    type T = Collections[K];
    const rows = () => this.snapshot(name) as T[];
    return {
      list: async () => rows(),
      get: async (id) => rows().find((r) => r.id === id) ?? null,
      insert: async (input: Insert<T>) => {
        const row = (await this.call("POST", `/${name}`, input)) as T;
        this.set(name, [...rows(), row]);
        return row;
      },
      update: async (id, patch: Patch<T>) => {
        const row = (await this.call("PATCH", `/${name}/${encodeURIComponent(id)}`, patch)) as T | null;
        if (row) this.set(name, rows().map((r) => (r.id === id ? row : r)));
        return row;
      },
      remove: async (id) => {
        await this.call("DELETE", `/${name}/${encodeURIComponent(id)}`);
        if (rows().some((r) => r.id === id)) this.set(name, rows().filter((r) => r.id !== id));
      },
    };
  }

  presets = this.table("presets");
  dashboards = this.table("dashboards");
  watchlist = this.table("watchlist");
  alert_rules = this.table("alert_rules");
  alert_events = this.table("alert_events");
  journal = this.table("journal");

  // Profile writes are optimistic and ordered (T-wt2j). The snapshot every reader sees (the topic picker, the filter bar) is the
  // last server-confirmed profile with the not-yet-answered patches laid over it, so it changes the moment a patch is made, not
  // after a 150-400 ms round trip. Patches go to the server one at a time in the order made, so a slow earlier answer can't
  // overwrite a later one (and the me_topics cookie, set by each answer, ends on the final list). A failed patch drops out of
  // the overlay (the snapshot rolls back to the confirmed profile) and the queue carries on.
  private confirmed: Profile | null = null;
  private pending: Partial<Profile>[] = [];
  private profileQueue: Promise<unknown> = Promise.resolve();
  private recompute() { this.profileRow = this.pending.reduce<Profile>((p, q) => ({ ...p, ...q }), this.confirmed ?? this.profileRow); }

  /** The page is being left (pagehide): send this profile change once, with keepalive so it survives the navigation. Not queued, not
   *  awaited; the full-list saves still queued or in flight are idempotent, so they can land before or after it. */
  flushProfile(p: Partial<Profile>): void {
    try { void this.fetcher(this.base + "/profile", { method: "PATCH", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).catch(() => {}); } catch { /* best effort */ }
  }

  profile = {
    get: async () => this.profileRow,
    patch: (p: Partial<Profile>): Promise<Profile> => {
      this.confirmed ??= this.profileRow;
      this.pending.push(p);
      this.recompute();
      this.emit();
      const run = async (): Promise<Profile> => {
        try {
          this.confirmed = (await this.call("PATCH", "/profile", p)) as Profile;
          return this.confirmed;
        } finally {
          this.pending = this.pending.filter((x) => x !== p);   // answered, either way
          this.recompute();
          this.emit();
        }
      };
      const result = this.profileQueue.then(run, run);
      this.profileQueue = result.catch(() => undefined);
      return result;
    },
  };
}
