// F9: where /state sends the visitor back to. Same-site paths only. Any control character or DEL is refused outright
// (the URL parser strips tab/CR/LF, so "/\t/evil.example" would become "//evil.example"), then the value is resolved
// against a dummy origin and must stay on it; the result is rebuilt from pathname + search + hash.
const BASE = "https://same-site.invalid";

export function safeNext(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  let u: URL;
  try { u = new URL(v, BASE); } catch { return null; }
  if (u.origin !== BASE) return null;
  const out = u.pathname + u.search + u.hash;
  if (out.startsWith("//") || u.pathname === "/state" || u.pathname.startsWith("/state/")) return null;
  return out;
}
