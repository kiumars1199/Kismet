"use client";
// The dotted live line of a ProofLine as a toggle: tap, Enter or Space shows the definition (p.help) as visible text under
// it, Escape or another tap hides it. Rule 3: the basis is one tap away; a title= attribute alone is unreachable on touch
// and keyboard. An inline span with role=button keeps the line wrapping exactly as before (a <button> would turn it into
// an inline-block). Opening is user-initiated, so its height change falls inside the input window (no CLS).
import { useId, useState, type KeyboardEvent } from "react";

export function ProofLive({ live, help }: { live: string; help: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }   // only the help closes: the drawer's window Escape handler skips a prevented event
  };
  return (
    <>
      <span data-testid="proof-live" role="button" tabIndex={0} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} onKeyDown={onKey}
        className="cursor-help underline decoration-dotted underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{live}</span>
      {/* always in the page (hidden when closed), so aria-controls points at an element that exists */}
      <span id={id} data-testid="proof-help" hidden={!open} className="mt-1.5 block text-[13px] leading-relaxed text-muted [&[hidden]]:hidden">{help}</span>
    </>
  );
}
