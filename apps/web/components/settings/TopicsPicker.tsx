"use client";
// Favorite topics (docs/05 F-08): a grid of taxonomy topics (level 2) with open-market counts. Chosen by the user
// only, never derived from saves or bets. Writes profile.favorite_topics on every toggle.
// Used by /onboarding and the /settings page (Lane D2 renders <TopicsPicker />).
import { useEffect, useId, useRef, useState } from "react";
import { createTopicSaver } from "@/lib/topics/saver";
import { setActiveTopicSaver } from "@/lib/topics/active";
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

const LABELS = new Map(GROUPS.flatMap((g) => g.topics).map((t) => [t.id, t.label]));
/** "Couldn't save A. Tap it to try again." Up to three are named; more read "A, B and N more". */
function errorText(names: string[]): string {
  const who = names.length <= 3
    ? (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0])
    : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  return `Couldn't save ${who}. Tap ${names.length === 1 ? "it" : "them"} to try again.`;
}
// The status line reserves the height of its longest possible text, built from the longest real labels.
const LONGEST = [...LABELS.values()].sort((a, b) => b.length - a.length);
const WORST_ERRORS = [errorText(LONGEST.slice(0, 3)), errorText([...LONGEST.slice(0, 2), ...Array(12).fill("x")])];

export function TopicsPicker() {
  const { favorite_topics } = useProfile();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  // A tap on the server HTML (before React has attached) is dropped by the browser. So until hydration the tiles are an honest not-ready
  // state, the same as "Skip setup": disabled, dimmed, cursor-wait, and the picker is aria-busy. Nothing waits or replays the tap.
  const [ready, setReady] = useState(false);
  const uid = useId();
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const ac = new AbortController();
    fetchMeta({ signal: ac.signal }).then((m) => setCounts(m.facets.topics), () => setCounts({}));
    return () => ac.abort();
  }, []);

  // Quick taps (T-wt2j): the picker keeps its own list (`local`) and shows it at once. Saves are queued, one at a time, each
  // carrying the full current list (lib/topics/saver.ts), so the server ends on exactly what the tiles show however slow the
  // network is. A failed save drops `local` and the tiles fall back to the confirmed list. F5: a tap before AuthBoot has
  // switched to the account store would land in this browser's store and be dropped by the switch, so the saver waits for it.
  const [local, setLocal] = useState<string[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);   // topics whose save failed: the line says so until they're tapped again, or 5 s
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saver = useRef<ReturnType<typeof createTopicSaver> | null>(null);
  saver.current ??= createTopicSaver({
    isReady: isRepoReady,
    ready: () => Promise.race([repoReady, new Promise((r) => setTimeout(r, 8_000))]),
    current: () => getRepo().profileSnapshot().favorite_topics,
    save: (next) => getRepo().profile.patch(getRepo().profileSnapshot().topics_off ? { favorite_topics: next, topics_off: false } : { favorite_topics: next }),   // choosing topics turns "Your topics" back on; topics_off is only written when set, so a save never depends on the migration
    flush: (list) => {
      const repo = getRepo();
      (repo as unknown as { flushProfile?: (p: object) => void }).flushProfile?.(repo.profileSnapshot().topics_off ? { favorite_topics: list, topics_off: false } : { favorite_topics: list });
    },
    onLocal: setLocal,
    onError: (dropped) => {
      setFailed((f) => [...new Set([...f, ...dropped])]);
      if (failTimer.current) clearTimeout(failTimer.current);
      failTimer.current = setTimeout(() => setFailed([]), 5_000);
    },
  });
  useEffect(() => () => { if (failTimer.current) clearTimeout(failTimer.current); }, []);
  // Leaving the page with saves still queued (a quick tap, then a link or reload): freeze the queue and send the full list once with
  // keepalive. Unmounting (onboarding moving to its next step) with saves pending sends it too, without freezing: the queue goes on.
  useEffect(() => {
    setActiveTopicSaver(saver.current);
    const hidden = () => { if (document.visibilityState === "hidden") saver.current?.freeze(); };
    const back = () => { if (document.visibilityState !== "hidden") saver.current?.resume(); };
    const leave = () => { saver.current?.freeze(); };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", back);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", back);
      document.removeEventListener("visibilitychange", hidden); document.removeEventListener("visibilitychange", back);
      saver.current?.flushNow();
    };
  }, []);
  const toggle = (id: string) => { setFailed((f) => f.filter((x) => x !== id)); saver.current!.toggle(id); };
  const errorLine = failed.length ? errorText(failed.map((id) => LABELS.get(id) ?? id)) : null;
  const chosen = local ?? favorite_topics;

  return (
    <div data-testid="topics-picker" aria-busy={!ready} className="flex flex-col gap-6">
      {/* One grid cell holds the shown line and invisible copies of the longest others, so the cell is as tall as the tallest and swapping
          lines (they wrap differently on phones) never moves the tiles. */}
      <p className={`grid text-sm ${errorLine ? "text-warning" : "text-muted"}`} aria-live="polite">
        {[...WORST_ERRORS, "12 chosen. They show first in your quick filters.", "Choose any you follow. You can change them later in Settings."].map((t) => (
          <span key={t} aria-hidden="true" className="invisible col-start-1 row-start-1">{t}</span>
        ))}
        <span className="col-start-1 row-start-1">{errorLine ?? (chosen.length ? `${chosen.length} chosen. They show first in your quick filters.` : "Choose any you follow. You can change them later in Settings.")}</span>
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
              const on = chosen.includes(t.id);
              const n = counts?.[t.id];
              return (
                <button key={t.id} type="button" aria-pressed={on} disabled={!ready} aria-describedby={`${uid}-${t.id}`} onClick={() => toggle(t.id)}
                  className={`flex min-h-12 flex-col items-start justify-center gap-0.5 rounded-input border px-3.5 py-2.5 text-left text-sm disabled:cursor-wait disabled:opacity-60 ${
                    on ? "border-accent-border bg-accent-bg text-accent-soft" : "border-border bg-input text-soft enabled:hover:border-accent-border enabled:hover:text-text"
                  }`}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={`flex size-4 flex-none items-center justify-center rounded-[5px] border ${on ? "border-accent bg-accent text-on-accent" : "border-muted"}`}>
                      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                    </span>
                    {t.label}
                  </span>
                  {/* the count is the tile's description, not part of its name: "NBA" stays "NBA" when "none open" arrives */}
                  <span id={`${uid}-${t.id}`} aria-hidden="true" className={`ml-6 block h-4 whitespace-nowrap text-xs leading-4 tabular-nums ${on ? "text-accent-softer" : "text-muted"}`}>
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
