// Owner: Lane D (T-30 presets). Screener pages render <PresetBar state onChange />.
type FilterState = Record<string, unknown>; // replaced by lib/filters/state in T-13

export function PresetBar(_props: { state: FilterState; onChange: (patch: Partial<FilterState>) => void }) {
  return null;
}
