import { clampCandidates } from "./fitclamp118.ts";
import fs from "node:fs";
const qs = ["Will the Bank of Israel decrease the Bank of Israel Interest Rate by 25 bps at the November meeting?", "Will the Bank of Israel increase the Bank of Israel Interest Rate by 25 bps at the November meeting?", "Will the Bank of Israel decrease the Bank of Israel Interest Rate by 50+ bps at the November meeting?", "Will the Bank of Israel make no change to the Bank of Israel Interest Rate at the November meeting?"];
fs.writeFileSync(process.argv[2], JSON.stringify(qs.map((q) => ({ q, c: clampCandidates(q) }))));
