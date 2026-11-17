import { LocalRepo } from "./local";
import type { Repo } from "./types";

export * from "./types";

/** NEXT_PUBLIC_DEMO_MODE defaults to true when unset. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

let repo: Repo | null = null;

export function getRepo(): Repo {
  if (!DEMO_MODE) throw new Error("SupabaseRepo not built yet: set NEXT_PUBLIC_DEMO_MODE=true");
  return (repo ??= new LocalRepo());
}
