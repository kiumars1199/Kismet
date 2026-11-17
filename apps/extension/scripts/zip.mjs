// pnpm ext:zip → builds a store copy (no dev `key`) into dist-store/ and zips it to marketedge-extension-<version>.zip.
// Set ME_ORIGIN to the production web origin first, e.g. ME_ORIGIN=https://marketedge.example pnpm ext:zip
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const env = { ...process.env, STORE: "1", OUT_DIR: "dist-store" };
const origin = env.ME_ORIGIN || "http://localhost:3000";
if (origin.includes("localhost")) console.warn(`[ext:zip] ME_ORIGIN is ${origin}: fine for loading unpacked, not for the store.`);
const run = (args) => execFileSync("pnpm", args, { stdio: "inherit", env });
run(["exec", "vite", "build"]);
run(["exec", "vite", "build", "-c", "vite.content.config.ts"]);
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const out = `marketedge-extension-${version}.zip`;
rmSync(out, { force: true });
execFileSync("zip", ["-qr", `../${out}`, "."], { cwd: "dist-store", stdio: "inherit" });
console.log(`[ext:zip] wrote apps/extension/${out}`);
