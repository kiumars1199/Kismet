// T-wt3: the plan copy around the combo checker, in one place so the pages and their tests agree.
import { quota } from "@/lib/entitlements";

/** /combos for Free and Pro: the combo checker is theirs, the suggested combos and the tray are Premium's. */
export const COMBOS_PAGE_FREE_PRO = {
  have: "Check any combo you build in the combo checker.",
  premium: "Premium adds suggested combos and the combo tray.",
} as const;

/** The combo checker's note under "Check this combo": Free only (Pro and Premium have no limit). */
export const COMBO_CHECK_FREE_NOTE = `Free includes ${quota("free", "checks_day")} check a day (a bet or a combo); this combo counts as one.`;

/** The box after the limit is hit (429): the same sentence as the note before the check, plus what to do. */
export const COMBO_LIMIT_USED = `Free includes ${quota("free", "checks_day")} check a day (a bet or a combo), and you've used it. Pro and Premium check as many bets and combos as you like.`;

/** Free's plan card line (the real limit: lib/entitlements checks_day), and Pro's. */
export const FREE_CHECK_LIMIT_LINE = `${quota("free", "checks_day")} bet or combo check a day`;
export const PRO_CHECKER_POINT = "Bet and combo checker, unlimited";
