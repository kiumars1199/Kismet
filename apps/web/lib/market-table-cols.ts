// /markets table: a pinned px width per column (the table is `table-layout: fixed`, so rows mounting while you scroll can't re-size
// columns). Whole class strings, so Tailwind sees them; widthAt() reads the same strings, so the numbers tested are the numbers rendered.
// A fixed table is exactly as wide as its columns whatever the font. Market is the flexible column: it takes what the others leave (so a
// Pro column added at 1280 narrows Market instead of making the box scroll), never below MARKET_MIN, and the table's min-width is the sum
// with that minimum. test/market-table-cols.test.ts pins the numbers.
export const MARKET_MIN = 140;
export const COL_CLASS: Record<string, string> = {
  star: "w-[60px]",
  market: "",   // no width: the one flexible column. In a fixed table it gets exactly what the others leave, whatever the content, so it is stable too
  bet: "w-[136px] min-[1366px]:w-[170px] min-[1440px]:w-[240px]",   // from 1440 the Bet cell never wraps
  return: "w-[126px]", won: "w-[97px]", says: "w-[100px]", chance: "w-[120px]", closes: "w-[70px]",
  topic: "w-[60px] min-[1366px]:w-[70px] min-[1440px]:w-[112px]",
  alert: "w-[158px]",
  mid: "w-[88px]", spread: "w-[96px]", fee: "w-[80px]", volume: "w-[96px]", volume_24h: "w-[110px]", liquidity: "w-[100px]",
  evidence: "w-[104px]", level: "w-[120px]", type: "w-[120px]", retention: "w-[104px]", capacity: "w-[104px]",
  verdict: "w-[120px]", realistic: "w-[130px]",
};

export const DEFAULT_COLUMNS = ["star", "market", "bet", "return", "won", "says", "chance", "closes", "topic", "alert"];

/** Width in px of a column at a viewport width (0 = the base width). */
export function widthAt(id: string, viewport: number): number {
  const cls = COL_CLASS[id] ?? "w-[100px]";
  const base = /(?:^| )w-\[(\d+)px\]/.exec(cls);
  if (!base) return id === "market" ? MARKET_MIN : 100;
  let px = Number(base[1]);
  for (const m of cls.matchAll(/min-\[(\d+)px\]:w-\[(\d+)px\]/g)) if (viewport >= Number(m[1])) px = Number(m[2]);
  return px;
}

/** The box the table sits in at a viewport width: the page's side padding and scrollbar take 66 px (measured: 1280 -> 1214). */
export const boxAt = (viewport: number) => viewport - 66;
export const defaultSum = (viewport: number) => DEFAULT_COLUMNS.reduce((a, id) => a + widthAt(id, viewport), 0);

/** What Market gets at a viewport width with these other columns visible: the box minus the others (never below MARKET_MIN). */
export const marketAt = (viewport: number, ids: string[] = DEFAULT_COLUMNS) =>
  Math.max(MARKET_MIN, boxAt(viewport) - ids.filter((id) => id !== "market").reduce((a, id) => a + widthAt(id, viewport), 0));
