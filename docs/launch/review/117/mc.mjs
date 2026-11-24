/** Shorten a long title in the middle ("Will the highest temperature … 60-61°F on November 17?"), keeping the end: that is where the date or
 *  line that tells similar bets apart lives. At most `max` characters, cut at word boundaries where there is one. */
function middleClamp(title, max) {
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
import fs from "fs";
const files = process.argv.slice(2);
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, "utf8")); const rows = j.flags ?? j.markets ?? j;
  const qs = [...new Set(rows.map((r) => r.question))];
  for (const max of [52, 64]) {
    const m = new Map(); for (const q of qs) { const c = middleClamp(q, max); m.set(c, [...(m.get(c) ?? []), q]); }
    const clamped = qs.filter((q) => q.length > max).length;
    const coll = [...m.values()].filter((v) => v.length > 1);
    console.log(`${f.split("/").slice(-2).join("/")} max ${max}: ${qs.length} titles, ${clamped} shortened, ${coll.length} shortened lines shared by >1 different bet (${coll.reduce((a, v) => a + v.length, 0)} bets)`);
    for (const v of coll.slice(0, 4)) console.log(`   "${middleClamp(v[0], max)}" <= ${v.slice(0, 3).map((x) => JSON.stringify(x)).join(" / ")}`);
  }
  const L = [...qs].sort((a, b) => b.length - a.length).slice(0, 3); for (const q of L) console.log(`   longest ${q.length}: ${q}\n     52: ${middleClamp(q, 52)}\n     64: ${middleClamp(q, 64)}`);
}
