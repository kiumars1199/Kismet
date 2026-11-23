"use client";
// The Best bets headline. Free sees the day's sample, so it reads "10 of 34 bets ...". When the user's topics filter that
// sample down to nothing it says so plainly, with one button to see it; the line is the same for every Free user
// (it depends on counts only: no personalized picks).
import { Count } from "@/components/kit";

export function BestBetsHeading({ total, shown, sample = false, onShowAll }: { total?: number; shown: number; sample?: boolean; onShowAll: () => void }) {
  const cls = "text-[28px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[34px]";
  if (total !== undefined && sample && shown === 0 && total > 0) {
    const what = total === 1 ? "pick" : "bets";
    return (
      <>
        <h1 className={cls}>{total === 1 ? "Today's free pick isn't in your topics" : "Today's free bets aren't in your topics"}</h1>
        <button type="button" data-testid="show-free-sample" onClick={onShowAll}
          className="inline-flex min-h-11 w-fit items-center rounded-xl border border-border px-4 text-sm font-medium text-accent-hover hover:bg-raised">
          Show today&apos;s free {what}
        </button>
      </>
    );
  }
  return (
    <h1 className={cls}>
      {total !== undefined
        ? <>{sample && shown < total ? <>{shown} of </> : null}<Count n={total} /> {total === 1 ? "bet" : "bets"} where the odds lean your way</>
        : "Bets where the odds lean your way"}
    </h1>
  );
}
