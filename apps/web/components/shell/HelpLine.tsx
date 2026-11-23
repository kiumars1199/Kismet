import { HELPLINE, helplineLinks } from "@/lib/helpline";

/** F8: where to get help, from config/site.json. Footer, /account and the pause screen. */
export function HelpLine({ className = "" }: { className?: string }) {
  const l = helplineLinks();
  const a = "inline-flex min-h-11 min-w-11 items-center underline underline-offset-2 hover:text-text";   // 44 x 44 px tap target, no taller line (-my)
  return (
    <p data-testid="helpline" className={className}>
      Gambling problem? Call or text{" "}
      <a href={l.call} className={`${a} justify-center -my-3 font-medium`}>{HELPLINE.number_display}</a>
      {" "}or <a href={l.chat} target="_blank" rel="noopener noreferrer" className={`${a} justify-center -my-3`}>chat online</a>
      {" "}({HELPLINE.operator}, 24/7,{" "}
      <a href={HELPLINE.source_url} target="_blank" rel="noopener noreferrer" className={`${a} justify-start -my-3`}>source</a>, checked {HELPLINE.checked}).
    </p>
  );
}
