// /api/mcp: the Kismet MCP server (T-280), streamable HTTP, stateless. Bearer auth only (OAuth 2.1 via Supabase,
// lib/mcp/auth.ts): no cookies, no BotID (AI clients can't solve it), plan gates and rate limits per tool call
// (lib/mcp/server.ts). Serves the 2026-07-28 protocol and, statelessly, 2025-era clients.
import { createMcpHandler } from "@modelcontextprotocol/server";
import { authenticate } from "@/lib/mcp/auth";
import { buildServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(() => buildServer(), {
  legacy: "stateless",
  responseMode: "json",
  onerror: (e) => console.error("[mcp]", e.message),
});

const noStore = (res: Response) => {
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
};

async function serve(req: Request): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return noStore(auth);
  return noStore(await handler.fetch(req, { authInfo: auth }));
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
