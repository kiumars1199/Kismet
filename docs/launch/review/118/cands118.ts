import { clampCandidates } from "./fitclamp118.ts";
import fs from "node:fs";
const qs: string[] = [...new Set(JSON.parse(fs.readFileSync("/home/user/MarketEdge/output/flags.json", "utf8")).flags.map((f: { question: string }) => f.question))] as string[];
const out = qs.map((q) => ({ q, c: clampCandidates(q) }));
// monotonic length check
let nonMono = 0; for (const { c } of out) for (let i = 1; i < c.length; i++) if (c[i].length > c[i - 1].length) { nonMono++; break; }
console.error(`titles ${qs.length}, titles whose candidates ever get longer: ${nonMono}`);
fs.writeFileSync(process.argv[2], JSON.stringify(out));
