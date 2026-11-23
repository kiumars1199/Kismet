import { HELPLINE, helplineLinks } from "@/lib/helpline";

/** F8: where to get help, from config/site.json. Footer, /account and the pause screen. */
export function HelpLine({ className = "" }: { className?: string }) {
  const l = helplineLinks();
  return (
    <p data-testid="helpline" className={className}>
      Gambling problem? Call or text{" "}
      <a href={l.call} className="font-medium underline underline-offset-2 hover:text-text">{HELPLINE.number_display}</a>
      {" "}or <a href={l.chat} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text">chat online</a>
      {" "}({HELPLINE.operator}, 24/7,{" "}
      <a href={HELPLINE.source_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text">source</a>, checked {HELPLINE.checked}).
    </p>
  );
}
