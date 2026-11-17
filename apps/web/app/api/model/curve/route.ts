import { curve } from "@/lib/data/model";
import { notFound, withStore } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const segment = p.get("segment") || "all";
  const h = Number(p.get("h") || 24);
  return withStore((store) => {
    const c = curve(store.model, segment, h);
    return c ? Response.json(c) : notFound("Curve");
  });
}
