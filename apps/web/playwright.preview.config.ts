import { defineConfig } from "@playwright/test";

// Smoke flows S3 (drawer) and S5 (My list) against a Vercel preview deployment, never production.
// Q, Nov 22: no bot-protection bypass on production. Previews accept Vercel's "Protection Bypass for Automation"
// secret, sent as a header on every request (https://vercel.com/docs/deployment-protection/automated-agent-access).
//   PREVIEW_URL=https://kismet-xxx.vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=... pnpm e2e:preview
const url = process.env.PREVIEW_URL ?? "";
const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
if (!/^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/.test(url)) {
  throw new Error("PREVIEW_URL must be a https://<deployment>.vercel.app preview URL (production is not allowed)");
}
if (!secret) throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is required (Vercel → Settings → Deployment Protection)");

export default defineConfig({
  testDir: "e2e",
  testMatch: /s3-drawer|s5-mylist/,
  grep: /S3 drawer|S5 star two markets/,   // the other S5 test seeds fixture ids that only exist in test/fixtures
  retries: 1,
  use: {
    baseURL: url.replace(/\/$/, ""),
    extraHTTPHeaders: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" },
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
});
