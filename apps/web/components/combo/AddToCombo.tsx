"use client";
// Drawer → "Add to combo tray" (docs/18 §5.1). Toggles this market's chosen side in the user's combo tray.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useEntitlements } from "@/lib/entitlements";
import { legOf } from "@/lib/combos";
import type { Side, StoreMarket } from "@/lib/types";
import { useCombo } from "./useCombo";
import { BetaBadge } from "@/components/beta/BetaBadge";

/** The link inside it is an inline-block with vertical padding: its 44 px tap target is part of the line, so the button below cannot cover its bottom (T-wt3f; it was an inline box in T-wt3e).
 *  The tray refuses a second bet from one event; its message ends with this line, which the button turns into a link with both bets. */
const CHECKER_LINE = "You can still check them together in the combo checker.";

/** reserve: the server says this user has combos; until /api/me answers keep an invisible same-size slot so the row does not re-wrap. */
export function AddToCombo({ m, s, className, reserve = false }: { m: StoreMarket; s: Side; className: string; reserve?: boolean }) {
  const leg = useCombo((c) => c.legs.find((l) => l.market_id === m.id));
  const add = useCombo((c) => c.add);
  const remove = useCombo((c) => c.remove);
  const trayLegs = useCombo((c) => c.legs);
  const [error, setError] = useState<string | null>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  // The tray (and the tab bar) are fixed to the bottom of the screen: when a refusal opens under them, bring it up above them, so its link can be tapped without scrolling (T-wt3g)
  useEffect(() => { if (error) alertRef.current?.scrollIntoView({ block: "nearest" }); }, [error]);
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
      {error && <p ref={alertRef} role="alert" className="basis-full scroll-mb-[calc(176px+env(safe-area-inset-bottom))] text-[13px] text-warning md:scroll-mb-28">{error.includes(CHECKER_LINE) ? <>{error.replace(CHECKER_LINE, "")}You can still check them together in the <Link href={`/check/combo?legs=${encodeURIComponent([...trayLegs.map((l) => `${l.market_id}:${l.side_index}`), `${m.id}:${s.side_index}`].join(","))}`} className="inline-block py-3.5 underline underline-offset-2">combo checker</Link>.</> : error}</p>}
    </>
  );
}
