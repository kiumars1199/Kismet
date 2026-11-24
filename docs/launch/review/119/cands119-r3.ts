import { clampCandidates } from "./fitclamp119r3.ts";
import fs from "node:fs";
const real: string[] = [...new Set(JSON.parse(fs.readFileSync("/home/user/MarketEdge/output/flags.json", "utf8")).flags.map((f: { question: string }) => f.question))] as string[];
const PAIRS: [string, string][] = [["increase", "decrease"], ["hike", "cut"], ["raise", "lower"], ["above", "below"], ["over", "under"], ["more", "less"], ["more", "fewer"], ["higher", "lower"], ["up", "down"], ["rise", "fall"], ["before", "after"], ["win", "lose"], ["yes", "no"], ["gain", "lose"], ["greater", "less"], ["exceed", "miss"], ["increases", "decreases"], ["hikes", "cuts"], ["rises", "falls"], ["beat", "miss"], ["highest", "lowest"], ["most", "fewest"], ["top", "bottom"]];
const swap = (q: string, a: string, b: string) => q.replace(new RegExp(`\\b${a}\\b`, "g"), "\u0000").replace(new RegExp(`\\b${b}\\b`, "g"), a).replace(/\u0000/g, b);
const groups: { kind: string; pair: string; titles: string[] }[] = [];
for (const q of real) for (const [a, b] of PAIRS) { const re = new RegExp(`\\b(${a}|${b})\\b`); if (re.test(q)) groups.push({ kind: "real-swapped", pair: `${a}/${b}`, titles: [q, swap(q, a, b)] }); }
const SYN = [
  ["Will the Federal Reserve %s the federal funds target range by 25 bps after the December 2026 FOMC meeting concludes?", ["increase", "decrease"]],
  ["Will the European Central Bank %s the deposit facility rate by 50+ bps at its December 2026 monetary policy meeting?", ["hike", "cut"]],
  ["Will the highest temperature in Rio de Janeiro on Tuesday November 24 be 29°C or %s according to the official station?", ["higher", "lower"]],
  ["Will the price of Bitcoin be %s $95,000 on Coinbase at 12:00 PM Eastern Time on Friday November 27, 2026?", ["above", "below"]],
  ["Total points scored in the Kansas City Chiefs vs. Las Vegas Raiders game on Thanksgiving Day: %s 47.5 points?", ["over", "under"]],
  ["Will the S&P 500 close %s on the final trading day of November 2026 compared with the previous trading day close?", ["up", "down"]],
  ["Will US initial jobless claims for the week ending November 21 come in %s than 225,000 according to the Department of Labor?", ["more", "fewer"]],
  ["Will Novak Djokovic %s his opening match at the 2026 Nitto ATP Finals round-robin stage in Turin, Italy?", ["win", "lose"]],
  ["Will the Bank of England make %s change to the Bank of England Bank Rate at the December 2026 Monetary Policy Committee meeting?", ["no", "a"]],
] as const;
for (const [t, [a, b]] of SYN) groups.push({ kind: "synthetic", pair: `${a}/${b}`, titles: [t.replace("%s", a), t.replace("%s", b)] });
const all = [...new Set([...real, ...groups.flatMap((g) => g.titles)])];
fs.writeFileSync(process.argv[2], JSON.stringify({ real, groups, cands: Object.fromEntries(all.map((q) => [q, clampCandidates(q)])) }));
console.log(`real ${real.length}, groups ${groups.length} (${groups.filter((g) => g.kind === "real-swapped").length} from real titles), titles ${all.length}`);
