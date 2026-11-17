// Safe to import from client and server code (no Node builtins).

// Demo mode (docs/01 § Demo scope): no auth, no billing, tier forced to premium, LocalRepo.
// Defaults to true when unset; only DEMO_MODE=false turns it off.
export const DEMO_MODE = process.env.DEMO_MODE !== "false";

export type DataSource = "local" | "github" | "supabase";
const SOURCES: DataSource[] = ["local", "github", "supabase"];
/** local (dev, default) | github (`live` branch) | supabase (private Storage bucket `scan`, docs/14 §4). */
export const DATA_SOURCE: DataSource = SOURCES.find((s) => s === process.env.DATA_SOURCE) ?? "local";

/** Folder with markets.json etc. for DATA_SOURCE=local; relative paths resolve from cwd (apps/web). */
export const dataDirSetting = () => process.env.DATA_DIR || "../../output";

export const github = () => ({
  token: process.env.GITHUB_DATA_TOKEN,
  repo: process.env.GITHUB_DATA_REPO || "kiumars1199/marketedge",
  ref: process.env.GITHUB_DATA_REF || "live",
});

/** Server only: the service key never leaves the server (no NEXT_PUBLIC_ prefix). */
export const supabaseStorage = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, ""),
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: "scan",
});
