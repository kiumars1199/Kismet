import { marketsPage, userCtx, withStore } from "@/lib/data/respond";
import { parse } from "@/lib/filters/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  return withStore((store) => Response.json(marketsPage(store, parse(p), userCtx(p))));
}
