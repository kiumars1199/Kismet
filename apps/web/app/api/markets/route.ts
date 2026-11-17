import { marketsPage, withStore } from "@/lib/data/respond";
import { parse } from "@/lib/filters/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  withStore((store) => Response.json(marketsPage(store, parse(new URL(req.url).searchParams))));
