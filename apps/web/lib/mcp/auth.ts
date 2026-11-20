// MCP bearer auth (T-280). /api/mcp is an OAuth 2.1 protected resource (RFC 9728); Supabase Auth's OAuth server is
// the authorization server (PKCE, dynamic client registration, consent at /oauth/consent). Access tokens are
// ordinary Supabase JWTs plus a `client_id` claim. Server only.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { OAuthError, OAuthErrorCode, bearerAuthChallengeResponse, requireBearerAuth, type AuthInfo, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { authEnabled, type SessionUser } from "@/lib/auth/server";
import { siteUrl } from "@/lib/site";

/** The resource identifier: exactly the URL people paste into "Add custom connector". */
export const mcpResource = () => `${siteUrl()}/api/mcp`;
/** RFC 9728 metadata URL for /api/mcp (path-suffixed form). The bare /.well-known/oauth-protected-resource serves the same. */
export const mcpMetadataUrl = () => `${siteUrl()}/.well-known/oauth-protected-resource/api/mcp`;
/** Supabase's OAuth 2.1 issuer. Discovery: <project>/.well-known/oauth-authorization-server/auth/v1. */
export const issuer = () => `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "")}/auth/v1`;

/** The protected resource metadata document. No `scopes_supported`: Supabase's OAuth server issues no custom scopes,
 *  and `openid` needs asymmetric signing keys (owner step), so nothing is advertised that can't be granted. */
export const resourceMetadata = () => ({
  resource: mcpResource(),
  authorization_servers: [issuer()],
  bearer_methods_supported: ["header"],
  resource_name: "Kismet",
  resource_documentation: `${siteUrl()}/llms.txt`,
});

const b64json = (part: string): Record<string, unknown> => {
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const invalid = (why: string) => new OAuthError(OAuthErrorCode.InvalidToken, why);

/** Supabase verifies the token (signature, expiry, revoked session) with GET /auth/v1/user; the claims are read only
 *  after that. Only OAuth-client tokens are accepted: a site session token (no `client_id`) is refused, so a stolen
 *  browser cookie can't be replayed here and the consent screen is the only way in. */
export const supabaseVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) {
      const status = (error as { status?: number } | null)?.status;
      if (error && status !== undefined && status >= 500) throw new OAuthError(OAuthErrorCode.ServerError, "Sign-in service unavailable");
      throw invalid("Invalid or expired token");
    }
    const claims = b64json(token.split(".")[1] ?? "");
    const clientId = typeof claims.client_id === "string" ? claims.client_id : "";
    if (!clientId) throw invalid("Not an OAuth access token");
    if (claims.sub !== data.user.id) throw invalid("Token subject mismatch");
    const exp = typeof claims.exp === "number" ? claims.exp : 0;
    const user: SessionUser = { id: data.user.id, email: data.user.email ?? "", verified: !!data.user.email_confirmed_at };
    return { token, clientId, scopes: [], expiresAt: exp, extra: { user } } satisfies AuthInfo;
  },
};

let forced: OAuthTokenVerifier | null = null;
/** Tests (and the e2e mock) swap the verifier. */
export const _setVerifier = (v: OAuthTokenVerifier | null) => void (forced = v);

/** The verified token, or the 401 challenge Response (`WWW-Authenticate: Bearer resource_metadata="…"`).
 *  With accounts off (demo mode, no Supabase keys) every request is refused: the endpoint never opens without a user. */
export async function authenticate(req: Request): Promise<AuthInfo | Response> {
  const resourceMetadataUrl = mcpMetadataUrl();
  if (!forced && !authEnabled()) return bearerAuthChallengeResponse(invalid("Sign-in is not configured"), { resourceMetadataUrl });
  return requireBearerAuth({ verifier: forced ?? supabaseVerifier, resourceMetadataUrl })(req);
}

export const userOf = (auth: AuthInfo | undefined): SessionUser | null => (auth?.extra?.user as SessionUser | undefined) ?? null;
