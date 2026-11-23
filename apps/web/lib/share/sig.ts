// F13: a share link carries a signature over (market id, side), so only links a signed-in person actually shared render
// the model's numbers in the public share image; every other request gets the teaser card (T-276: no model output
// without an account). Keyed by the existing server secret UNSUBSCRIBE_SECRET (no new env var), domain-separated.
// Outside production without the secret a fixed dev key is used so local runs and tests work; in production without it
// nothing is signed and nothing verifies (every image is the teaser).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const secretOf = (s?: string) => s ?? process.env.UNSUBSCRIBE_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-share-key");
const mac = (secret: string, id: string, side: number) =>
  createHmac("sha256", createHash("sha256").update(`me:share:v1:${secret}`).digest()).update(`${id}|${side}`).digest("base64url").slice(0, 22);

export function shareSig(id: string, side: number, secret?: string): string | null {
  const k = secretOf(secret);
  return k ? mac(k, id, side) : null;
}

export function verifyShareSig(id: string, side: number, sig: string | null | undefined, secret?: string): boolean {
  const k = secretOf(secret);
  if (!k || !sig || sig.length !== 22) return false;
  const a = Buffer.from(mac(k, id, side)), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
