// Paid-e2e data: test/fixtures plus one open Politics market (the fixture has none, and F5's e2e picks NFL + Politics).
// Writes test-results/paid-fixtures; the unit tests keep reading test/fixtures untouched, so their counts don't move.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const out = "test-results/paid-fixtures";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync("test/fixtures", out, { recursive: true });

const file = `${out}/markets.json`;
const data = JSON.parse(readFileSync(file, "utf8"));
const base = data.markets.find((m) => m.category === "geopolitics");
data.markets.push({
  ...base,
  id: "f05-politics-1",
  question: "Will the incumbent win the 2026 governor race?",
  event: "2026 governor race",
  event_id: "f05-politics-event",
  slug: "f05-governor-race",
  url: "https://polymarket.com/event/f05-governor-race",
  category: "politics",
  niche: "politics",
  tags: ["politics", "elections"],
});
writeFileSync(file, JSON.stringify(data));
