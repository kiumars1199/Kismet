// FilterState <-> URL query (docs/04 § URL encoding). Short keys, defaults omitted, arrays comma-joined,
// booleans 1/0, sort "key.dir". parse() ignores unknown keys and drops invalid values (falls back to default).
import { FilterState, defaultState } from "./state";

type Kind = "str" | "num" | "bool" | "list";
const KEYS = {
  q: ["q", "str"], view: ["view", "str"], c: ["categories", "list"], xc: ["exclude_categories", "list"],
  t: ["topics", "list"], mt: ["market_types", "list"], per: ["periods", "list"], side: ["side", "str"],
  p0: ["price_min", "num"], p1: ["price_max", "num"], x0: ["pays_min", "num"], x1: ["pays_max", "num"],
  wp: ["win_prob_min", "num"], wp1: ["win_prob_max", "num"], e: ["edge_min", "num"],
  conf: ["edge_low_positive", "bool"], roi: ["roi_min", "num"], val: ["validated_only", "bool"],
  vd: ["verdicts", "list"], ret: ["retention_min", "num"], cap: ["capacity_min_usd", "num"],
  ev: ["min_events", "num"], cw: ["closes_within_h", "num"], ca: ["closes_after_h", "num"],
  live: ["live_only", "bool"], fq: ["frequency", "list"], vol: ["volume_min", "num"],
  v24: ["volume_24h_min", "num"], liq: ["liquidity_min", "num"], sp: ["spread_max", "num"],
  wl: ["watchlisted_only", "bool"], fav: ["favorites_only", "bool"], g: ["group_by_event", "bool"],
  s: ["sort", "str"], tz: ["tz", "str"], pg: ["page", "num"], ps: ["page_size", "num"],
} as const satisfies Record<string, readonly [keyof FilterState, Kind]>;

const DEFAULTS = defaultState();
const sortStr = (s: FilterState["sort"]) => `${s.key}.${s.dir}`;

export function serialize(f: FilterState): URLSearchParams {
  const out = new URLSearchParams();
  for (const [short, [field, kind]] of Object.entries(KEYS)) {
    const v = f[field];
    if (v === undefined) continue;
    if (field === "sort") {
      if (sortStr(f.sort) !== sortStr(DEFAULTS.sort)) out.set(short, sortStr(f.sort));
      continue;
    }
    if (v === DEFAULTS[field]) continue;
    if (kind === "list") out.set(short, (v as string[]).join(","));
    else if (kind === "bool") out.set(short, v ? "1" : "0");
    else out.set(short, String(v));
  }
  return out;
}

export const toQuery = (f: FilterState) => {
  const s = serialize(f).toString();
  return s ? `?${s}` : "";
};

export function parse(input: URLSearchParams | string | Record<string, string | string[] | undefined>): FilterState {
  const params =
    input instanceof URLSearchParams ? input
    : typeof input === "string" ? new URLSearchParams(input)
    : new URLSearchParams(Object.entries(input).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v]])));
  const shape = FilterState.shape;
  const obj: Record<string, unknown> = {};
  for (const [short, [field, kind]] of Object.entries(KEYS)) {
    const raw = params.get(short);
    if (raw === null) continue;
    let v: unknown;
    if (field === "sort") {
      const [key, dir] = raw.split(".");
      v = { key, dir };
    } else if (kind === "list") v = raw.split(",").filter(Boolean);
    else if (kind === "bool") v = raw === "1" || raw === "true" ? true : raw === "0" || raw === "false" ? false : undefined;
    else if (kind === "num") v = raw.trim() === "" ? undefined : Number(raw);
    else v = raw;
    if (v === undefined || (Array.isArray(v) && v.length === 0)) continue;
    if (shape[field].safeParse(v).success) obj[field] = v;
  }
  return FilterState.parse(obj);
}
