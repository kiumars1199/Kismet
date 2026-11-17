// Small presentational pieces shared by cards, rows and the drawer.
import { DASH } from "@/lib/format";
import { NOTE_TONE, type Note } from "./labels";

/** A formatted value; "—" gets the "not available" tooltip. */
export function Val({ v, title, className }: { v: string; title?: string; className?: string }) {
  return (
    <span className={className} title={v === DASH ? "not available" : title}>
      {v}
    </span>
  );
}

const w = (p: number | null | undefined) => `${Math.max(0, Math.min(1, typeof p === "number" && Number.isFinite(p) ? p : 0)) * 100}%`;

/** "Market says" vs "Won before" bars (8px on cards, 10px in the drawer). */
export function OddsBars({ market, won, big, labels = ["Market says", "Won before"], basis }: {
  market: number; won: number; big?: boolean; labels?: [string, string]; basis?: string;
}) {
  const h = big ? "h-2.5" : "h-2";
  const pct = (p: number) => (Number.isFinite(p) ? `${Math.round(p * 100)}%` : DASH);
  return (
    <div className={`flex flex-col ${big ? "gap-2.5 text-[13px]" : "gap-1.5 text-xs"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`${big ? "w-[120px]" : "w-[74px]"} flex-none text-muted`}>{labels[0]}</span>
        <div className={`${h} flex-1 rounded-full bg-muted-bg`}><div className={`${h} rounded-full bg-market-bar`} style={{ width: w(market) }} /></div>
        <span className="w-9 text-right tabular-nums">{pct(market)}</span>
      </div>
      <div className="flex items-center gap-2.5" title={basis}>
        <span className={`${big ? "w-[120px]" : "w-[74px]"} flex-none text-muted`}>{labels[1]}</span>
        <div className={`${h} flex-1 rounded-full bg-muted-bg`}><div className={`${h} rounded-full bg-accent`} style={{ width: w(won) }} /></div>
        <span className="w-9 text-right tabular-nums text-accent-soft">{pct(won)}</span>
      </div>
    </div>
  );
}

export function Notes({ notes, className = "" }: { notes: Note[]; className?: string }) {
  if (!notes.length) return null;
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-0.5 text-xs ${className}`}>
      {notes.map((n) => (
        <li key={n.text} className={`flex items-center gap-1.5 ${NOTE_TONE[n.tone]}`}>
          {n.tone !== "muted" && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
          {n.text}
        </li>
      ))}
    </ul>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-input bg-muted-bg ${className}`} />;
}
