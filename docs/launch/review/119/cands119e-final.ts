import { clampCandidates } from "./fitclamp-final.ts";
import fs from "node:fs";
const P = (pair: string, a: string, b: string) => ({ kind: "synthetic", pair, titles: [a, b] });
const nfl = (x: string) => `Will Patrick Mahomes throw for ${x} passing yards in the Kansas City Chiefs vs Las Vegas Raiders game on Thanksgiving?`;
const btc = (x: string) => `Will the price of Bitcoin ${x} on Coinbase at 12:00 PM Eastern Time on Friday November 27, 2026?`;
const ten = (x: string) => `Will Novak Djokovic ${x} Carlos Alcaraz in the 2026 Nitto ATP Finals round-robin stage match in Turin, Italy on Sunday?`;
const boe = (x: string) => `${x}: will the Bank of England change the Bank Rate at the December 2026 Monetary Policy Committee meeting in London?`;
const f1 = (x: string) => `Will Max Verstappen finish ${x} in the 2026 Abu Dhabi Grand Prix at the Yas Marina Circuit according to official FIA results?`;
const sets = [
  P("more than / less than", nfl("more than 285"), nfl("less than 285")),
  P("more than / exact", nfl("more than 285"), nfl("285")),
  P("up to / at least", nfl("up to 285"), nfl("at least 285")),
  P("up to / exact", nfl("up to 285"), nfl("285")),
  P("beats / loses to", ten("beat"), ten("lose to")),
  P("beats / loses to (3rd person)", "Novak Djokovic beats Carlos Alcaraz in the 2026 Nitto ATP Finals round-robin stage match in Turin, Italy on Sunday?", "Novak Djokovic loses to Carlos Alcaraz in the 2026 Nitto ATP Finals round-robin stage match in Turin, Italy on Sunday?"),
  P("wins / loses", "Novak Djokovic wins against Carlos Alcaraz in the 2026 Nitto ATP Finals round-robin stage match in Turin, Italy on Sunday?", "Novak Djokovic loses against Carlos Alcaraz in the 2026 Nitto ATP Finals round-robin stage match in Turin, Italy on Sunday?"),
  P("Yes / No lead-in", boe("Yes"), boe("No")),
  P("Yes / No lead-in (lowercase, no colon)", "yes or no will the Bank of England change the Bank Rate at the December 2026 Monetary Policy Committee meeting in London", "no or yes will the Bank of England change the Bank Rate at the December 2026 Monetary Policy Committee meeting in London"),
  P("first / last", f1("first"), f1("last")),
  P("1st / last", f1("1st"), f1("last")),
  P("first / second", f1("first"), f1("second")),
  P("last / exact (no place)", f1("last"), f1("on the podium")),
  P("earliest / latest", "Will the earliest US snowfall of 1 inch or more in Atlanta, Georgia during the 2026-27 winter season happen in December?", "Will the latest US snowfall of 1 inch or more in Atlanta, Georgia during the 2026-27 winter season happen in December?"),
  P("over / under (by date)", btc("be over $95,000 by November 30"), btc("be under $95,000 by November 30")),
  P("lead / trail", "Will the Kansas City Chiefs lead the Las Vegas Raiders at halftime of the Thanksgiving Day game at Arrowhead Stadium in Kansas City?", "Will the Kansas City Chiefs trail the Las Vegas Raiders at halftime of the Thanksgiving Day game at Arrowhead Stadium in Kansas City?"),
];
const all = [...new Set(sets.flatMap((g) => g.titles))];
fs.writeFileSync(process.argv[2], JSON.stringify({ real: [], groups: sets, cands: Object.fromEntries(all.map((q) => [q, clampCandidates(q)])) }));
console.log("groups", sets.length);
