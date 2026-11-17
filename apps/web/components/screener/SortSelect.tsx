"use client";
import type { FilterState } from "@/lib/filters/state";

export const SORTS: { label: string; sort: FilterState["sort"] }[] = [
  { label: "Best expected return", sort: { key: "roi", dir: "desc" } },
  { label: "Most likely to win", sort: { key: "win_prob", dir: "desc" } },
  { label: "Closing soonest", sort: { key: "closes", dir: "asc" } },
  { label: "Biggest price gap (¢)", sort: { key: "edge", dir: "desc" } },
  { label: "Most traded", sort: { key: "volume", dir: "desc" } },
  { label: "Closest to 50/50", sort: { key: "competitive", dir: "asc" } },
  { label: "Newest", sort: { key: "newest", dir: "desc" } },
];

export function SortSelect({ sort, onChange, options = SORTS }: { sort: FilterState["sort"]; onChange: (s: FilterState["sort"]) => void; options?: typeof SORTS }) {
  const cur = `${sort.key}.${sort.dir}`;
  const known = options.some((o) => `${o.sort.key}.${o.sort.dir}` === cur);
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      Sort
      <select
        value={cur}
        onChange={(e) => {
          const [key, dir] = e.target.value.split(".") as [FilterState["sort"]["key"], "asc" | "desc"];
          onChange({ key, dir });
        }}
        className="min-h-10 rounded-[10px] border border-border bg-input px-2.5 text-text focus:border-accent"
      >
        {!known && <option value={cur}>Custom ({sort.key}, {sort.dir === "asc" ? "low first" : "high first"})</option>}
        {options.map((o) => (
          <option key={o.label} value={`${o.sort.key}.${o.sort.dir}`}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
