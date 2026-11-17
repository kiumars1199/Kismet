import { z } from "zod";
import { curve } from "@/lib/data/model";
import { notFound, withStore } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// docs/15: unknown keys rejected, values bounded. The segment is only a lookup key into model.json.
const Query = z.object({
  segment: z.string().max(120).default("all").transform((s) => s || "all"),
  h: z.coerce.number().min(0).max(24 * 365).default(24),
}).strict();

export function GET(req: Request) {
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return Response.json({ error: "bad query" }, { status: 400 });
  const { segment, h } = q.data;
  return withStore((store) => {
    const c = curve(store.model, segment, h);
    return c ? Response.json(c) : notFound("Curve");
  });
}
