"use client";
// Drawer → "Add to combo tray" (docs/18 §5.1). Toggles this market's chosen side in the user's combo tray.
import Link from "next/link";
import { useState } from "react";
import { useEntitlements } from "@/lib/entitlements";
import { legOf } from "@/lib/combos";
import type { Side, StoreMarket } from "@/lib/types";
import { useCombo } from "./useCombo";
import { BetaBadge } from "@/components/beta/BetaBadge";

/** The link inside it has vertical padding on an inline box: its tap target is 44 px tall and the line does not grow (T-wt3e).
 *  The tray refuses a second bet from one event; its message ends with this line, which the button turns into a link with both bets. */
const CHECKER_LINE = "You can still check them together in the combo checker.";

/** reserve: the server says this user has combos; until /api/me answers keep an invisible same-size slot so the row does not re-wrap. */
export function AddToCombo({ m, s, className, reserve = false }: { m: StoreMarket; s: Side; className: string; reserve?: boolean }) {
  const leg = useCombo((c) => c.legs.find((l) => l.market_id === m.id));
  const add = useCombo((c) => c.add);
  const remove = useCombo((c) => c.remove);
  const trayLegs = useCombo((c) => c.legs);
  const [error, setError] = useState<string | null>(null);
  const inCombo = leg?.side_index === s.side_index;
  // Combos are Premium (lib/beta.ts live rule; out of beta since Nov 21)
  const ent = useEntitlements();
  const allowed = ent.canBeta("combos");
  if (!allowed) return reserve && !ent.known ? <span aria-hidden="true" data-testid="combo-slot" className={`${className} invisible`}>Add to combo tray <BetaBadge className="ml-1.5" /></span> : null;
  return (
    <>
      <button
        type="button" aria-pressed={inCombo} className={className}
        onClick={() => {
          if (inCombo) return remove(m.id);
          setError(add(legOf(m, s)));
        }}
      >
        {inCombo ? "In combo ✓" : leg ? "Switch combo side" : "Add to combo tray"} <BetaBadge className="ml-1.5" />
      </button>
      {error && <p role="alert" className="basis-full text-[13px] text-warning">{error.includes(CHECKER_LINE) ? <>{error.replace(CHECKER_LINE, "")}You can still check them together in the <Link href={`/check/combo?legs=${encodeURIComponent([...trayLegs.map((l) => `${l.market_id}:${l.side_index}`), `${m.id}:${s.side_index}`].join(","))}`} className="py-3.5 underline underline-offset-2">combo checker</Link>.</> : error}</p>}
    </>
  );
}
