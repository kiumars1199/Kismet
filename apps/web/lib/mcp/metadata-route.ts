// RFC 9728 protected resource metadata for /api/mcp, served at /.well-known/oauth-protected-resource/api/mcp (the
// path-suffixed form MCP clients try first) and at /.well-known/oauth-protected-resource. Public, CORS *, no secrets.
import { resourceMetadata } from "./auth";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" };

export const metadataGET = () => Response.json(resourceMetadata(), { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
export const metadataOPTIONS = () => new Response(null, { status: 204, headers: CORS });
