// Owner: Lane D (T-31 quick chips + favorite topics). Screener pages render <QuickChips state onChange />.
type FilterState = Record<string, unknown>; // replaced by lib/filters/state in T-13

export function QuickChips(_props: { state: FilterState; onChange: (patch: Partial<FilterState>) => void }) {
  return null;
}
