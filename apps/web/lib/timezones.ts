// Time zone choices for Settings. Intl.supportedValuesOf("timeZone") leaves out "UTC" (and can lack a zone saved from an
// older browser), so a <select> whose value isn't an option silently shows its first entry ("Africa/Abidjan").
// The saved zone and "UTC" are always in the list.
export function timeZoneOptions(saved: string | undefined, supported?: string[]): string[] {
  let base: string[];
  try { base = supported ?? Intl.supportedValuesOf("timeZone"); } catch { base = []; }
  const extra = ["UTC", saved].filter((z): z is string => !!z && !base.includes(z));
  return [...new Set([...extra.filter((z) => z === "UTC"), ...base, ...extra.filter((z) => z !== "UTC")])];
}
