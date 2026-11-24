"use client";
// The bet line on /signup?next=/m/<id>: "Sign up for the verdict on: <title>". The title is shown WHOLE when it fits 2 lines in the real box, and is
// shortened (lib/fit-clamp: filler words, then names, then the middle of the text) only as far as it has to be, measured in the browser, so the
// "Create account" button keeps its place above the tab bar / the fold. Before hydration (and with scripts off) the full title is there with a
// 2-line clamp; the measure runs before the first paint after hydration and again when the box or the fonts change.
import { useLayoutEffect, useRef, useState } from "react";
import { fitClamp } from "@/lib/fit-clamp";

export const BET_LEDE = "Sign up for the verdict on: ";

export function BetLine({ title }: { title: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [text, setText] = useState(title);
  useLayoutEffect(() => {
    const p = ref.current;
    const node = p?.firstChild;
    if (!p || !node) return;
    const fits = (t: string) => { node.nodeValue = BET_LEDE + t; return p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1; };   // line-clamp-2: clipped text counts in scrollHeight
    const run = () => {
      const best = fitClamp(title, fits);
      node.nodeValue = BET_LEDE + best;   // the search leaves the DOM on its last probe, which is not always the answer; and when the answer is the
      setText(best);                      // state React already holds there is no re-render to put it right
    };
    run();
    // The words reflow when the web font swaps in (a clamped box keeps its height, so the ResizeObserver doesn't see it): measure again when fonts finish
    // loading, when the page has loaded, and shortly after, as well as when the box changes size.
    const ro = new ResizeObserver(run);
    ro.observe(p);
    void document.fonts?.ready.then(run);
    document.fonts?.addEventListener?.("loadingdone", run);
    window.addEventListener("load", run);
    const timers = [400, 1500].map((ms) => window.setTimeout(run, ms));
    return () => { ro.disconnect(); document.fonts?.removeEventListener?.("loadingdone", run); window.removeEventListener("load", run); timers.forEach(clearTimeout); };
  }, [title]);
  return (
    <p ref={ref} data-testid="signup-bet" title={title} className="line-clamp-2 text-[13px] [@media(max-height:700px)]:text-[12px] font-medium leading-snug text-accent-soft md:text-[15px]">{BET_LEDE + text}</p>
  );
}
