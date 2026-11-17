"use client";

// Owner: Lane D (T-32 watchlist). Placeholder star; does nothing yet.
import type { Market } from "@/lib/types";

export function WatchStar({ marketId }: { marketId: string; side?: 0 | 1; market?: Market }) {
  return (
    <button type="button" aria-label={`Save market ${marketId} to My list`} aria-pressed={false} className="flex size-9 items-center justify-center rounded-input text-muted hover:text-accent">
      ☆
    </button>
  );
}
