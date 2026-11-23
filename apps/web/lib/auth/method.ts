// How this session was started, for /account's "Signed in as …" line. Supabase puts it in the access token's `amr` claim
// (password / otp / magiclink / oauth); the identity provider says Google. Display only: never a gate.
export type SignInMethod = "google" | "email_link" | "password";

export function signInMethod(accessToken: string | null | undefined, provider: string | null | undefined): SignInMethod | null {
  let amr: string[] = [];
  try {
    const payload = JSON.parse(Buffer.from(String(accessToken).split(".")[1] ?? "", "base64url").toString("utf8")) as { amr?: { method?: string }[] };
    amr = (payload.amr ?? []).map((a) => String(a.method));
  } catch { /* no readable claim */ }
  const first = amr[0];
  if (first === "password") return "password";
  if (first === "otp" || first === "magiclink" || first === "email/signup") return "email_link";
  if (first === "oauth" || provider === "google") return "google";
  return null;
}

/** The clause after the address: "Signed in as a@b.com, with an email link." Empty when the method is unknown. */
export const signInClause = (m: SignInMethod | null | undefined): string =>
  m === "google" ? ", with Google" : m === "email_link" ? ", with an email link" : m === "password" ? ", with your email and password" : "";
