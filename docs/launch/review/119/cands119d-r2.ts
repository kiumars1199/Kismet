import { clampCandidates } from "./fitclamp119r2.ts";
import fs from "node:fs";
const P = (pair: string, a: string, b: string) => ({ kind: "synthetic", pair, titles: [a, b] });
const bq = (x: string) => `Will Jean-Michel Basquiat's “Untitled (Leonardo and His Five Grotesque Heads)” sell for ${x} at auction?`;
const vg = (x: string) => `Will Vincent van Gogh's “Châtaigniers en fleurs” sell for ${x} at auction on November 20?`;
const hg = (x: string) => `Will "The Hunger Games: Sunrise on the Reaping" score ${x} on the Rotten Tomatoes Tomatometer?`;
const wx = (h: string, x: string) => `Will the ${h} temperature in Jean-Michel Basquiat's hometown of Brooklyn, New York be ${x} on November 17?`;
const sets = [
  P("BQ over/under", bq("over $40m")!, bq("under $40m")),
  P("BQ above/below", bq("above $40m"), bq("below $40m")),
  P("BQ or higher/exact", bq("$40m or higher"), bq("$40m")),
  P("BQ or more/exact", bq("$40m or more"), bq("$40m")),
  P("BQ fewer/at", bq("fewer than $40m"), bq("at $40m")),
  P("VG over/under", vg("over $175m"), vg("under $175m")),
  P("VG or higher/exact", vg("$175m or higher"), vg("$175m")),
  P("HG or higher/exact", hg("70 or higher"), hg("70")),
  P("HG fewer/at", hg("fewer than 70"), hg("at 70")),
  P("HG at least/at most", hg("at least 70"), hg("at most 70")),
  P("WX highest/lowest", wx("highest", "56°F"), wx("lowest", "56°F")),
  P("WX or higher/exact", wx("highest", "56°F or higher"), wx("highest", "56°F")),
  P("WX or below/exact", wx("highest", "56°F or below"), wx("highest", "56°F")),
];
const all = [...new Set(sets.flatMap((g) => g.titles))];
const cands = Object.fromEntries(all.map((q) => [q, clampCandidates(q)]));
fs.writeFileSync(process.argv[2], JSON.stringify({ real: [], groups: sets, cands }));
// any candidate keeping the number but not the "or X" qualifier?
let bad = 0; for (const [q, c] of Object.entries(cands)) { const m = q.match(/(\S+) or (higher|more|below|above|lower|less|fewer)/); if (!m) continue; for (const x of c) if (x.includes(m[1]) && !x.includes(`or ${m[2]}`)) { bad++; console.log("NUMBER WITHOUT QUALIFIER:", x); } }
console.log("candidates keeping number without 'or X':", bad);
