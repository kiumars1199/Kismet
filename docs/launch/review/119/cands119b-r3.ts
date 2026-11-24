import { clampCandidates } from "./fitclamp119r3.ts";
import fs from "node:fs";
const base = "Will the %H temperature in Rio de Janeiro on Tuesday November 24 be 29°C%S according to the official station?";
const v = (h: string, s: string) => base.replace("%H", h).replace("%S", s);
const sets = [
  ["or higher / exact", v("highest", " or higher"), v("highest", "")],
  ["or higher / or lower", v("highest", " or higher"), v("highest", " or lower")],
  ["or below / exact", v("highest", " or below"), v("highest", "")],
  ["highest / lowest (or higher)", v("highest", " or higher"), v("lowest", " or higher")],
  ["highest / lowest (exact)", v("highest", ""), v("lowest", "")],
  ["fewer / more", "Will US initial jobless claims for the week ending November 21 come in fewer than 225,000 according to the Department of Labor?", "Will US initial jobless claims for the week ending November 21 come in more than 225,000 according to the Department of Labor?"],
  ["fewer / exactly", "Will US initial jobless claims for the week ending November 21 come in fewer than 225,000 according to the Department of Labor?", "Will US initial jobless claims for the week ending November 21 come in at 225,000 according to the Department of Labor?"],
];
const groups = sets.map(([pair, a, b]) => ({ kind: "synthetic", pair, titles: [a, b] }));
const all = [...new Set(groups.flatMap((g) => g.titles))];
fs.writeFileSync(process.argv[2], JSON.stringify({ real: [], groups, cands: Object.fromEntries(all.map((q) => [q, clampCandidates(q)])) }));
