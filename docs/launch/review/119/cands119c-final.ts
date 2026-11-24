import { clampCandidates } from "./fitclamp-final.ts";
import fs from "node:fs";
const P = (pair: string, a: string, b: string) => ({ kind: "synthetic", pair, titles: [a, b] });
const btc = (x: string) => `Will the price of Bitcoin ${x} on Coinbase at 12:00 PM Eastern Time on Friday November 27, 2026?`;
const rio = (x: string) => `Will the highest temperature in Rio de Janeiro on Tuesday November 24 be ${x} according to the official station?`;
const nfl = (x: string) => `Will Patrick Mahomes throw for ${x} passing yards in the Kansas City Chiefs vs Las Vegas Raiders game on Thanksgiving?`;
const sets = [
  P("reach / dip to", btc("reach $95,000"), btc("dip to $95,000")),
  P("Will Bitcoin reach / dip (real shape, long)", "Will the price of Bitcoin reach $66,000 at any point during the week of November 16-22 according to Coinbase data?", "Will the price of Bitcoin dip to $66,000 at any point during the week of November 16-22 according to Coinbase data?"),
  P("at least / at most", nfl("at least 285"), nfl("at most 285")),
  P("at least / exactly", nfl("at least 285"), nfl("exactly 285")),
  P("between / outside", rio("between 28°C and 29°C"), rio("outside 28°C and 29°C")),
  P("between / not between", rio("between 28°C and 29°C"), rio("not between 28°C and 29°C")),
  P("or above / exact", rio("29°C or above"), rio("29°C")),
  P("or more / exact", nfl("285 or more"), nfl("285")),
  P("or less / exact", nfl("285 or less"), nfl("285")),
  P("or fewer / exact", nfl("285 or fewer"), nfl("285")),
  P("or lower / exact", rio("29°C or lower"), rio("29°C")),
  P("under / at", btc("under $95,000"), btc("at $95,000")),
  P("over / at", btc("over $95,000"), btc("at $95,000")),
  P("top / bottom", "Will the Kansas City Chiefs finish the 2026 NFL regular season in the top 5 of the AFC standings according to NFL.com?", "Will the Kansas City Chiefs finish the 2026 NFL regular season in the bottom 5 of the AFC standings according to NFL.com?"),
  P("minimum / maximum", "Will the minimum temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?", "Will the maximum temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?"),
  P("fewest / most", "Which team will allow the fewest points across all games of the 2026 NFL regular season through Week 12 according to ESPN?", "Which team will allow the most points across all games of the 2026 NFL regular season through Week 12 according to ESPN?"),
  P("by date / on date", btc("reach $95,000 by November 30"), btc("reach $95,000 on November 30")),
  P("by date / in month", "Will the Federal Reserve announce an emergency cut to the federal funds target range by December 2026 according to the FOMC statement?", "Will the Federal Reserve announce an emergency cut to the federal funds target range in December 2026 according to the FOMC statement?"),
  P("before / after date", "Will SpaceX launch the next Starship integrated flight test before December 15, 2026 from Starbase in Boca Chica, Texas?", "Will SpaceX launch the next Starship integrated flight test after December 15, 2026 from Starbase in Boca Chica, Texas?"),
  P("drop / hit", btc("drop to $95,000"), btc("hit $95,000")),
  P("above / at or above", btc("above $95,000"), btc("at or above $95,000")),
  P("less than / no more than", nfl("less than 285"), nfl("no more than 285")),
  P("higher / exact (no 'or')", rio("29°C higher than yesterday"), rio("29°C")),
  P("max / min", "Will the max temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?", "Will the min temperature recorded in Rio de Janeiro on Tuesday November 24 be 22°C according to the official station?"),
  P("positive / negative", "Will the US Bureau of Economic Analysis report positive real GDP growth for the third quarter of 2026 in its advance estimate?", "Will the US Bureau of Economic Analysis report negative real GDP growth for the third quarter of 2026 in its advance estimate?"),
  P("+ / - sign", "Will the Kansas City Chiefs cover the -3.5 point spread against the Las Vegas Raiders in the Thanksgiving Day game at Arrowhead?", "Will the Kansas City Chiefs cover the +3.5 point spread against the Las Vegas Raiders in the Thanksgiving Day game at Arrowhead?"),
  P("weekday / weekend (range words)", "Will the highest temperature in Rio de Janeiro during the weekend of November 28-29 be 29°C according to the official station?", "Will the highest temperature in Rio de Janeiro during the weekday of November 28-29 be 29°C according to the official station?"),
];
const all = [...new Set(sets.flatMap((g) => g.titles))];
fs.writeFileSync(process.argv[2], JSON.stringify({ real: [], groups: sets, cands: Object.fromEntries(all.map((q) => [q, clampCandidates(q)])) }));
console.log(`groups ${sets.length}`);
