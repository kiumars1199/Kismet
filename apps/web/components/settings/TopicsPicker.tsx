"use client";
// Favorite topics (docs/05 F-08): a grid of taxonomy topics (level 2) with open-market counts. Chosen by the user
// only, never derived from saves or bets. Writes profile.favorite_topics on every toggle.
// Used by /onboarding and the /settings page (Lane D2 renders <TopicsPicker />).
import { useEffect, useState } from "react";
import { fetchMeta } from "@/lib/api";
import { getRepo, isRepoReady, repoReady } from "@/lib/repo";
import { useProfile } from "@/lib/repo/hooks";
import { TAXONOMY_TREE, type TaxNode } from "@/lib/taxonomy";
import { formatCount } from "@/lib/format";

// level 2 = topics under each category; categories with no topics (World, Mentions) are a tile themselves
const GROUPS: { label: string; topics: TaxNode[] }[] = [
  ...TAXONOMY_TREE.filter((c) => c.children).map((c) => ({ label: c.label, topics: c.children!.filter((t) => !t.id.endsWith(".other")) })),
  { label: "More", topics: TAXONOMY_TREE.filter((c) => !c.children && c.id !== "other") },
];

export function TopicsPicker() {
  const { favorite_topics } = useProfile();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetchMeta({ signal: ac.signal }).then((m) => setCounts(m.facets.topics), () => setCounts({}));
    return () => ac.abort();
  }, []);

  // F5: a tap before AuthBoot has switched to the account store would land in this browser's store and be dropped by
  // the switch (the tile looked chosen, the account never got it). Wait for the account store, then toggle against
  // its current topics, so quick taps don't overwrite each other either.
  const toggle = async (id: string) => {
    if (!isRepoReady()) await Promise.race([repoReady, new Promise((r) => setTimeout(r, 8_000))]);
    const cur = getRepo().profileSnapshot();
    const next = cur.favorite_topics.includes(id) ? cur.favorite_topics.filter((x) => x !== id) : [...cur.favorite_topics, id];
    getRepo().profile.patch(cur.topics_off ? { favorite_topics: next, topics_off: false } : { favorite_topics: next });   // choosing topics turns "Your topics" back on; topics_off is only written when set, so a save never depends on the migration
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted" aria-live="polite">
        {favorite_topics.length ? `${favorite_topics.length} chosen. They show first in your quick filters.` : "Choose any you follow. You can change them later in Settings."}
      </p>
      {GROUPS.map((g) => {
        // Every group and topic from the static taxonomy is on screen from the first paint, and each tile reserves its count
        // line: when the "N open" counts arrive (a fetch after paint) nothing is added, removed or resized, so the page
        // doesn't shift (walk-through 2: CLS 0.1037 at 1440). A topic with nothing open says so instead of vanishing.
        const topics = g.topics;
        if (!topics.length) return null;
        return (
        <fieldset key={g.label} className="flex flex-col gap-2.5">
          <legend className="mb-2.5 font-heading text-sm font-semibold text-soft">{g.label}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {topics.map((t) => {
              const on = favorite_topics.includes(t.id);
              const n = counts?.[t.id];
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)}
                  className={`flex min-h-12 flex-col items-start justify-center gap-0.5 rounded-input border px-3.5 py-2.5 text-left text-sm ${
                    on ? "border-accent-border bg-accent-bg text-accent-soft" : "border-border bg-input text-soft hover:border-accent-border hover:text-text"
                  }`}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={`flex size-4 flex-none items-center justify-center rounded-[5px] border ${on ? "border-accent bg-accent text-on-accent" : "border-muted"}`}>
                      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    </span>
                    {t.label}
                  </span>
                  <span className={`ml-6 block h-4 whitespace-nowrap text-xs leading-4 tabular-nums ${on ? "text-accent-softer" : "text-muted"}`}>
                    {counts === null ? "" : n ? `${formatCount(n)} open` : "none open"}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        );
      })}
    </div>
  );
}
