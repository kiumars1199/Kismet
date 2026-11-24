/** Shorten a long title in the middle ("Will the highest temperature … 60-61°F on November 17?"), keeping the end: that is where the date or
 *  line that tells similar bets apart lives. At most `max` characters, cut at word boundaries where there is one. */
export function middleClamp(title: string, max: number): string {
  if (title.length <= max) return title;
  const tailLen = Math.min(Math.floor(max * 0.45), max - 10);
  const tailRaw = title.slice(title.length - tailLen);
  const midWord = title[title.length - tailLen - 1] !== " " && tailRaw[0] !== " ";   // the slice starts inside a word
  const tailAt = tailRaw.indexOf(" ");
  const tail = midWord && tailAt > 0 && tailAt < tailLen - 1 ? tailRaw.slice(tailAt + 1) : tailRaw.trimStart();   // start the end on a word
  const headRoom = max - tail.length - 3;   // " … " is three characters
  const headRaw = title.slice(0, headRoom);
  const headAt = headRaw.lastIndexOf(" ");
  const head = (headAt > headRoom * 0.4 ? headRaw.slice(0, headAt) : headRaw).trimEnd();
  return `${head} … ${tail}`;
}

const hasDigit = (w: string) => /\d/.test(w);
/** A word that tells bets apart: a number, or a Capitalised name (a city, a team, a month). Filler is the lowercase rest ("the", "highest", "be"). */
const keyWord = (w: string) => hasDigit(w) || /^\W*[A-Z]/.test(w) || KEEP.has(w.toLowerCase().replace(/[^a-z]/g, ""));
/** Lowercase words that decide WHICH bet it is (win vs finish on the podium, above vs less than, second vs third). */
const KEEP = new Set(["win", "wins", "lose", "finish", "podium", "above", "below", "less", "more", "over", "under", "before", "after", "first", "second", "third", "fourth", "fifth", "top", "least", "most", "beat",
  // which way a rate or a number moves: "decrease 25 bps" and "increase 25 bps" must never read alike
  "increase", "decrease", "hike", "cut", "raise", "lower", "no", "not", "change", "yes"]);

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
  const isKeep = (w: string) => KEEP.has(w.toLowerCase().replace(/[^a-z]/g, ""));
  const middleOut = (idx: number[]) => idx.sort((a, b) => Math.abs(a - words.length / 2) - Math.abs(b - words.length / 2));
  const drop = (pick: (w: string, i: number) => boolean) => {
    for (const i of middleOut(words.map((_, i) => i).filter((i) => keep[i] && i > 0 && pick(words[i]!, i)))) { keep[i] = false; out.push(render(words, keep)); }
  };
  // 0. a word that already appeared earlier in the title (the second "Bank of Israel"), before any distinct word is touched
  const seen = new Set<string>();
  const repeated = new Set<number>();
  words.forEach((w, i) => { const k = w.toLowerCase().replace(/[^a-z]/g, ""); if (k.length >= 2 && !hasDigit(w) && !isKeep(w)) { if (seen.has(k)) repeated.add(i); seen.add(k); } });
  drop((_, i) => repeated.has(i) && i < words.length - 1);
  drop((w) => !keyWord(w));                                                  // 1. filler
  drop((w, i) => i < words.length - 1 && !hasDigit(w) && !isKeep(w));       // 2. names (never the last word)
  drop((w) => isKeep(w) && !hasDigit(w));                                    // 3. the words that decide which bet ("win", "above", "second")
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
