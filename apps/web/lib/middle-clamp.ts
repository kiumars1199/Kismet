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
