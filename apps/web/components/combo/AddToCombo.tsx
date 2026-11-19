"use client";
// Drawer → "Add to combo" (docs/18 §5.1). Toggles this market's chosen side in the user's combo tray.
import Link from "next/link";
import { useState } from "react";
import { useEntitlements } from "@/lib/entitlements";
import { legOf } from "@/lib/combos";
import type { Side, StoreMarket } from "@/lib/types";
import { useCombo } from "./useCombo";

export function AddToCombo({ m, s, className }: { m: StoreMarket; s: Side; className: string }) {
  const leg = useCombo((c) => c.legs.find((l) => l.market_id === m.id));
  const add = useCombo((c) => c.add);
  const remove = useCombo((c) => c.remove);
  const [error, setError] = useState<string | null>(null);
  const inCombo = leg?.side_index === s.side_index;
  // docs/19 P3: combos are Premium; other plans get the way up instead of the tray
  const allowed = useEntitlements().can("combos");
  if (!allowed) return <Link href="/pricing" className={className}>Combos on Premium</Link>;
  return (
    <>
      <button
        type="button" aria-pressed={inCombo} className={className}
        onClick={() => {
          if (inCombo) return remove(m.id);
          setError(add(legOf(m, s)));
        }}
      >
        {inCombo ? "In combo ✓" : leg ? "Switch combo side" : "Add to combo"}
      </button>
      {error && <p role="alert" className="basis-full text-[13px] text-warning">{error}</p>}
    </>
  );
}
