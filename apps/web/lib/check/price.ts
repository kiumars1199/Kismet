// /check's Price field (T-wt3i). It is filled from the market, and the math must use the market's own price, not the rounded text:
// 0.999 shown as "100" would fail the 1–99% guard, and 0.8% shown as "1" would be scored as 1%.
// So the field keeps the exact price it was filled with, and the text it showed for it. While the text is still that text, the price is the
// exact one, and it counts as the market's (no 1–99% guard: it is not a typed value). Once the person types, the typed value is used and guarded.

/** The text a filled price shows: a whole percent inside 1–99% (68), two decimals at the extremes (99.9, 0.8) so it never reads as 100 or 0. */
export function fillText(ask: number): string {
  const p = ask * 100;
  return String(ask >= 0.01 && ask <= 0.99 ? Math.round(p) : +p.toFixed(2));
}

/** The price the numbers use, as a fraction, and whether it is the market's own (not typed). NaN price = an empty or unreadable field. */
export function effectivePrice(text: string, filled: number | null): { price: number; fromMarket: boolean } {
  if (filled !== null && text === fillText(filled)) return { price: filled, fromMarket: true };
  const t = text.trim();
  return { price: t === "" ? NaN : Number(t) / 100, fromMarket: false };
}
