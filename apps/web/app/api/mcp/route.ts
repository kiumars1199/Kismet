// /api/mcp: the Kismet MCP server (T-280), streamable HTTP, stateless. Bearer auth only (OAuth 2.1 via Supabase,
// lib/mcp/auth.ts): no cookies, no BotID (AI clients can't solve it), plan gates and rate limits per tool call
// (lib/mcp/server.ts). Serves the 2026-07-28 protocol and, statelessly, 2025-era clients.
import { createMcpHandler } from "@modelcontextprotocol/server";
import { authenticate } from "@/lib/mcp/auth";
import { buildServer } from "@/lib/mcp/server";
import { DISCLAIMER } from "@/components/shell/Footer";

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

type Msg = { result?: { content?: { type: string; text?: string }[] } };
/** Adds the disclaimer to every tool result in one JSON-RPC payload; false when there was nothing to change. */
function stamp(json: Msg | Msg[]): boolean {
  let changed = false;
  for (const m of Array.isArray(json) ? json : [json]) {
    const content = m?.result?.content;
    if (!Array.isArray(content)) continue;
    const last = content.at(-1);
    if (last?.type === "text" && last.text?.endsWith(DISCLAIMER)) continue;
    content.push({ type: "text", text: DISCLAIMER });
    changed = true;
  }
  return changed;
}

/** Every tool result ends with the disclaimer (CLAUDE.md rule 5), including the ones the SDK writes itself
 *  (argument validation, unknown tool). Our own tools already end with it and pass through untouched. POST answers
 *  only (one JSON body or a short SSE reply, both finite); a GET stream is never buffered. */
async function withDisclaimer(req: Request, res: Response): Promise<Response> {
  const type = res.headers.get("content-type") ?? "";
  const sse = type.includes("text/event-stream");
  if (req.method !== "POST" || !res.body || !(sse || type.includes("application/json"))) return res;
  const body = await res.text();
  let changed = false;
  const fix = (raw: string): string => {
    try {
      const json = JSON.parse(raw) as Msg | Msg[];
      if (!stamp(json)) return raw;
      changed = true;
      return JSON.stringify(json);
    } catch { return raw; }
  };
  const next = sse ? body.split("\n").map((l) => (l.startsWith("data:") ? `data: ${fix(l.slice(5).trim())}` : l)).join("\n") : fix(body);
  const out = new Response(changed ? next : body, res);
  if (changed) out.headers.delete("content-length");
  return out;
}

async function serve(req: Request): Promise<Response> {
  const auth = await authenticate(req);
  if (auth instanceof Response) return noStore(auth);
  return noStore(await withDisclaimer(req, await handler.fetch(req, { authInfo: auth })));
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
