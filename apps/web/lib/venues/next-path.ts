// F9: where /state sends the visitor back to. Same-site paths only (no "//host", no backslash tricks, no loop to /state).
export function safeNext(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  if (v === "/state" || v.startsWith("/state?") || v.startsWith("/state/")) return null;
  return v;
}
