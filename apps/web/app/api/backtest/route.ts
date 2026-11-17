import type { BacktestResponse } from "@/lib/api";
import { chosenResult } from "@/lib/data/model";
import { withStore } from "@/lib/data/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = () =>
  withStore((store) => {
    const body: BacktestResponse = { ...store.backtest, chosen: chosenResult(store.backtest) ?? null };
    return Response.json(body);
  });
