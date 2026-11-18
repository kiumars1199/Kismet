"use client";
// T-29, F-24: "Updated 12 min ago". Amber after 3 h, red after 6 h with "data may be stale".
// Fetches /api/meta itself (mounted in the header with no props); renders nothing until it knows.
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMeta } from "@/lib/api";
import { ago } from "@/lib/format";
import { freshness } from "@/lib/freshness";

const DOT = { fresh: "bg-accent", amber: "bg-warning", red: "bg-negative" } as const;
const TEXT = { fresh: "text-muted", amber: "text-warning", red: "text-negative" } as const;

export function FreshnessPill({ scannedAt: initial }: { scannedAt?: number }) {
  const [scannedAt, setScannedAt] = useState(initial);
  const [delay, setDelay] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const load = () => fetchMeta().then((m) => { setScannedAt(m.meta.scanned_at); setDelay(m.delay_min ?? 0); }).catch(() => {});
    if (initial === undefined) load();
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    const refetch = setInterval(load, 5 * 60_000);
    return () => { clearInterval(tick); clearInterval(refetch); };
  }, [initial]);

  if (scannedAt === undefined || now === null) return null;
  const level = freshness(scannedAt, now);
  const when = ago(scannedAt, now);
  const behind = delay > 0 ? ` On the Free plan you see prices ${delay} minutes behind.` : "";
  const title = level === "fresh"
    ? `Prices and win chances were last checked ${when}. Prices refresh about every 10 minutes.${behind}`
    : `The last scan was ${when}. Prices may have moved since, so check the market before betting.${behind}`;

  return (
    <Link href="/status" title={title} data-testid="freshness" data-level={level}
      className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-input px-2 text-xs hover:text-text ${TEXT[level]}`}>
      <span className={`size-[7px] shrink-0 rounded-full ${DOT[level]}`} aria-hidden="true" />
      <span className="max-sm:sr-only">Updated </span>{when}{level === "red" && <span className="max-sm:sr-only"> · data may be stale</span>}
    </Link>
  );
}
