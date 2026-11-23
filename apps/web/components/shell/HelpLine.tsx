import { HELPLINE, helplineLinks } from "@/lib/helpline";

/** F8: where to get help, from config/site.json. Footer, /account and the pause screen.
 *  The two actions are their own row of real buttons (>= 44 x 44, no negative margins, so no box overlaps another link);
 *  "source" is a plain inline link inside the sentence (WCAG 2.5.8 inline exception). */
export function HelpLine({ className = "" }: { className?: string }) {
  const l = helplineLinks();
  // the <a> is the square 44 px hit box; the rounded look is its child, so a tap in a corner of the box still lands on the link
  const btn = "group inline-flex min-h-11 min-w-11 items-stretch";
  const face = "flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-input border border-border px-4 text-center font-medium text-text group-hover:border-accent-border group-hover:text-accent-hover";
  return (
    <div data-testid="helpline" className={className}>
      <p>Gambling problem? Free, confidential help:</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <a href={l.call} className={btn}><span className={face}>Call or text {HELPLINE.number_display}</span></a>
        <a href={l.chat} target="_blank" rel="noopener noreferrer" className={btn}><span className={face}>Chat online</span></a>
      </div>
      <p className="mt-1.5">
        ({HELPLINE.operator}, 24/7,{" "}
        <a href={HELPLINE.source_url} target="_blank" rel="noopener noreferrer" data-inline-link className="underline underline-offset-2 hover:text-text">source</a>
        , checked {HELPLINE.checked}).
      </p>
    </div>
  );
}
