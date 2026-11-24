"use client";
// The Best bets headline. Free sees the day's sample, so it reads "10 of 34 bets ...". When the user's topics filter that
// sample down to nothing it says so plainly, with one button to see it; the line is the same for every Free user
// (it depends on counts only: no personalized picks). T-wt2b: a topic with no best bets today says so; a plain topic filter
// says "this filter" or the topic, never "your topics".
import { useEffect, useState, type ReactNode } from "react";
import { Count } from "@/components/kit";

/** `daily`: the Free allowance (free_daily), which decides "pick" or "bets": a topic with one match still leaves Free ten a day. */
export function BestBetsHeading({ total, shown, sample = false, daily, fallback = false, topicTotal, topic, yours = false, onShowAll, belowButton, emptyTitle, emptyBody, children }: { total?: number; shown: number; sample?: boolean; daily?: number; fallback?: boolean; topicTotal?: number; topic?: string; yours?: boolean; onShowAll: () => void; belowButton?: ReactNode; emptyTitle?: string; emptyBody?: ReactNode; children?: ReactNode }) {
  // The tap switches the line at once, so the row loses the button's height inside the 500 ms input window instead of
  // when the (slower) answer lands, where it would count as layout shift.
  const [asked, setAsked] = useState(false);
  useEffect(() => { if (shown > 0) setAsked(false); }, [shown]);
  const cls = "text-[28px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[34px]";
  // T-wt2d: nothing matches at all (a returning user whose only topic has no bets, a filter with no bets): the h1 is the message, and the
  // way out sits right under it, in the first view; "0 bets where the odds lean your way" over a blurb about wins was neither honest nor visible.
  if (emptyTitle) return <><h1 className={cls}>{emptyTitle}</h1>{emptyBody}</>;
  if (total !== undefined && sample && shown === 0 && total > 0 && !asked) {
    const what = daily === 1 ? "pick" : "bets";
    return (
      <>
        <h1 className={cls}>{`Today's free ${daily === 1 ? "pick isn't" : "bets aren't"} in ${yours ? "your topics" : topic ?? "this filter"}`}</h1>
        {/* The button takes the blurb's place (same grid cell, the blurb stays and only hides), so the row doesn't grow. T-wt2d: the locked
            card (belowButton) sits under the button in that same cell, so it fills the blurb's reserved height instead of pushing the page. */}
        <div className="grid">
          <div aria-hidden="true" className="invisible [grid-area:1/1]">{children}</div>
          <div className="flex flex-col items-start gap-2 [grid-area:1/1]">
            <button type="button" data-testid="show-free-sample" onClick={() => { setAsked(true); onShowAll(); }}
              className="inline-flex min-h-11 w-fit items-center self-start rounded-xl border border-border px-4 text-sm font-medium text-accent-hover hover:bg-raised">
              Show today&apos;s free {what}
            </button>
            {belowButton}
          </div>
        </div>
      </>
    );
  }
  if (fallback && sample && shown > 0) {   // first screen after onboarding: the chosen topics had none of today's sample
    return (
      <>
        <h1 data-free-fallback="" className={cls}>{topicTotal === 0
          ? `No best bets in ${topic ?? "your topics"} today. Here are today's free bets.`
          : "None of today's free bets are in your topics. Here are today's free bets."}</h1>
        {children}
      </>
    );
  }
  return (
    <>
    <h1 className={cls}>
      {total !== undefined && !(asked && sample && shown === 0)
        ? <>{sample && shown < total ? <>{shown} of </> : null}<Count n={total} /> {total === 1 ? "bet" : "bets"} where the odds lean your way</>
        : "Bets where the odds lean your way"}
    </h1>
    {children}
    </>
  );
}
