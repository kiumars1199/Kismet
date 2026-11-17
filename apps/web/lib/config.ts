// Safe to import from client and server code (no Node builtins).

// Demo mode (docs/01 § Demo scope): no auth, no billing, tier forced to premium, LocalRepo.
// Defaults to true when unset; only DEMO_MODE=false turns it off.
export const DEMO_MODE = process.env.DEMO_MODE !== "false";

export const DATA_SOURCE: "local" | "github" = process.env.DATA_SOURCE === "github" ? "github" : "local";

/** Folder with markets.json etc. for DATA_SOURCE=local; relative paths resolve from cwd (apps/web). */
export const dataDirSetting = () => process.env.DATA_DIR || "../../output";

export const github = () => ({
  token: process.env.GITHUB_DATA_TOKEN,
  repo: process.env.GITHUB_DATA_REPO || "kiumars1199/marketedge",
  ref: process.env.GITHUB_DATA_REF || "live",
});
