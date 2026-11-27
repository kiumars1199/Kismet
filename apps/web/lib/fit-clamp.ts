import { middleClamp } from "@/lib/middle-clamp";

const hasDigit = (w: string) => /\d/.test(w);
/** A word that tells bets apart: a number, or a Capitalised name (a city, a team, a month). Filler is the lowercase rest ("the", "highest", "be"). */
const keyWord = (w: string) => hasDigit(w) || /^\W*[A-Z]/.test(w) || KEEP.has(w.toLowerCase().replace(/[^a-z]/g, ""));
/** Lowercase words that decide WHICH bet it is (win vs finish on the podium, above vs less than, second vs third). */
const KEEP = new Set(["win", "wins", "lose", "finish", "podium", "above", "below", "less", "more", "over", "under", "before", "after", "first", "second", "third", "fourth", "fifth", "top", "least", "most", "beat",
  // which way a rate or a number moves: "decrease 25 bps" and "increase 25 bps" must never read alike
  "increase", "decrease", "hike", "cut", "raise", "lower", "no", "not", "change", "yes",
  // thresholds and ends of a range: "29°C or higher" vs "29°C", highest vs lowest, "fewer than 225,000" vs "at 225,000"
  "higher", "highest", "lowest", "fewer", "greater", "up", "down", "rise", "fall", "exceed", "exactly", "gain",
  // which end or which kind: reach vs "dip to", "drop to" vs hit, top vs bottom, most vs fewest, between vs outside, minimum vs maximum, positive vs negative, weekend vs weekday
  "reach", "dip", "drop", "hit", "bottom", "fewest", "outside", "between", "minimum", "maximum", "min", "max", "positive", "negative", "weekend", "weekday",
  // inflected forms and the far end: beats vs "loses to", wins/won vs loses/lost, lead vs trail, first vs last, earliest vs latest
  "beats", "loses", "lost", "won", "leads", "lead", "trails", "trail", "last", "latest", "earliest"]);
const DATE_WORD = new Set(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
/** A small word that changes the meaning of the word after it: "or higher", "at least", "by November 30" vs "on November 30" vs "in December". */
const joins = (w: string, next: string | undefined) => !!next && (
  (w === "or" && KEEP.has(next)) || (w === "at" && (next === "least" || next === "most")) || ((w === "by" || w === "in" || w === "on") && DATE_WORD.has(next)));

/** `words` with the dropped ones shown as one "…" per run. */
function render(words: string[], keep: boolean[]): string {
  const out: string[] = [];
  let gap = false;
  words.forEach((w, i) => {
    if (keep[i]) { if (gap) { out.push("…"); gap = false; } out.push(w); } else gap = true;
  });
  if (gap) out.push("…");
  return out.join(" ");
}

/** Every shortening of `title`, from the whole title down to a few characters, each no longer than the one before:
 *  0. repeated words (the second "Bank of Israel" in "the Bank of Israel Interest Rate")
 *  1. filler words (lowercase, no digit, not a deciding word; never the first word) dropped from the middle outward: "Will the highest … Los Angeles … 66-67°F on November 18?"
 *  2. then names and other words without a digit, from the middle outward (first and last words stay)
 *  3. then the deciding words ("win", "above", "second") and
 *  4. last the text cut in the middle (middleClamp), a character at a time.
 *  Numbers and dates survive longest, then the words that make one bet different from its neighbour. */
export function clampCandidates(title: string): string[] {
  const words = title.split(" ");
  const out = [title];
  const keep = words.map(() => true);
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "");
  // "or" just before a deciding word stays with it ("29°C or higher"), so do "at least" and "by/in/on" before a date
  const orKeep = words.map((w, i) => joins(norm(w), i + 1 < words.length ? norm(words[i + 1]!) : undefined) || (norm(w) === "to" && i > 0 && norm(words[i - 1]!) === "up"));   // ("up to" keeps its "to")
  const isKeep = (i: number) => KEEP.has(norm(words[i]!)) || orKeep[i]!;
  const key = (i: number) => keyWord(words[i]!) || orKeep[i]!;
  const middleOut = (idx: number[]) => idx.sort((a, b) => Math.abs(a - words.length / 2) - Math.abs(b - words.length / 2));
  const drop = (pick: (i: number) => boolean) => {
    for (const i of middleOut(words.map((_, i) => i).filter((i) => keep[i] && i > 0 && pick(i)))) { keep[i] = false; out.push(render(words, keep)); }
  };
  // 0. a word that already appeared earlier in the title (the second "Bank of Israel"), before any distinct word is touched
  const seen = new Set<string>();
  const repeated = new Set<number>();
  words.forEach((w, i) => { const k = norm(w); if (k.length >= 2 && !hasDigit(w) && !isKeep(i)) { if (seen.has(k)) repeated.add(i); seen.add(k); } });
  drop((i) => repeated.has(i) && i < words.length - 1);
  drop((i) => !key(i));                                                          // 1. filler
  drop((i) => i < words.length - 1 && !hasDigit(words[i]!) && !isKeep(i));      // 2. names (never the last word)
  drop((i) => isKeep(i) && !hasDigit(words[i]!));                                // 3. the words that decide which bet ("win", "above", "or higher")
  for (let l = Math.min(title.length, out[out.length - 1]!.length) - 1; l >= 8; l--) out.push(middleClamp(title, l));   // 4. cut the text
  return out;
}

/** The title shortened only as far as it has to be: the first (longest) candidate `fits` accepts; the whole title when it fits. `fits` measures
 *  the real text in the real box (the browser), or a character budget in tests. Candidates only get shorter, so a binary search finds it. */
export function fitClamp(title: string, fits: (text: string) => boolean): string {
  const c = clampCandidates(title);
  let lo = 0, hi = c.length - 1, best = c[hi]!;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (fits(c[mid]!)) { best = c[mid]!; hi = mid - 1; } else lo = mid + 1;
  }
  return best;
}
