// Shared by RememberHeight (reports the height), /api/bets/height (sets the cookie) and loading.tsx (reads it).
export const REMEMBER_COOKIE = "bets_h";
export const MIN_RESERVE = 12_000;   // a few screens of cards when nothing is remembered
export const MAX_RESERVE = 80_000;   // a 50-bet Premium page is ~33,000 px at 390
