import { multX } from "@/lib/card";

/** What a $1 stake returns if the bet wins, after the fee, as a multiplier. Below 1x (a price near 100% plus its fee) a win still returns
 *  less than the stake, and "1.00x" would hide that: it reads "less than 1x" (T-wt3i). */
export const paysAfterFee = (x: number) => (x < 1 ? "less than 1x" : multX(x));
