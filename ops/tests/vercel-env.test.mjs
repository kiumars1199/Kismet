// A fake `vercel` on PATH records each call and its stdin; nothing reaches Vercel.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { commands, show } from "../vercel-env.mjs";
import { ROOT } from "../lib.mjs";
import { GOOD_ENV, GOOD_SITE } from "./fixtures.mjs";

test("commands: production + preview, secrets sensitive, test-only vars skipped", () => {
  const cs = commands({ STRIPE_SECRET_KEY: "sk_test_x", DATA_SOURCE: "supabase", E2E_MOCK: "1", NEXT_PUBLIC_DEMO_MODE: "false", EMPTY: "" });
  assert.deepEqual(cs.map((c) => `${c.key}/${c.target}/${c.sensitive}`), [
    "STRIPE_SECRET_KEY/production/true", "STRIPE_SECRET_KEY/preview/true", "DATA_SOURCE/production/false", "DATA_SOURCE/preview/false"]);
  assert.deepEqual(cs[0].args, ["env", "add", "STRIPE_SECRET_KEY", "production", "--force", "--sensitive"]);
  assert.doesNotMatch(show({ ...cs[0], value: "sk_test_SECRETVALUE" }), /SECRETVALUE/);
  assert.match(show(cs[2]), /printf '%s' 'supabase' \| vercel env add DATA_SOURCE production --force$/);
});

test("CLI --yes: refuses with preflight blockers, else feeds values on stdin", () => {
  const dir = mkdtempSync(join(tmpdir(), "me-vercel-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  mkdirSync(join(dir, ".vercel"));
  writeFileSync(join(dir, ".vercel/project.json"), "{}");
  const log = join(dir, "log");
  writeFileSync(join(bin, "vercel"), `#!/bin/sh\nprintf '%s|' "$*" >> "${log}"\n[ "$1" = whoami ] || cat >> "${log}"\necho >> "${log}"\n`);
  chmodSync(join(bin, "vercel"), 0o755);
  const site = join(dir, "site.json");
  writeFileSync(site, JSON.stringify(GOOD_SITE));
  const envFile = join(dir, ".env");
  const run = (env) => {
    writeFileSync(envFile, Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("\n"));
    return execFileSync("node", [join(ROOT, "ops/vercel-env.mjs"), "--env", envFile, "--site", site, "--cwd", dir, "--yes"], {
      encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
  };
  assert.throws(() => run({ ...GOOD_ENV, DEMO_MODE: "true" }), /Command failed/);
  assert.throws(() => readFileSync(log), "nothing ran");

  const out = run(GOOD_ENV);
  assert.doesNotMatch(out, new RegExp(GOOD_ENV.STRIPE_SECRET_KEY), "secret never printed");
  const lines = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(lines[0], "whoami|");
  assert.ok(lines.includes(`env add STRIPE_SECRET_KEY production --force --sensitive|${GOOD_ENV.STRIPE_SECRET_KEY}`));
  assert.ok(lines.includes("env add DATA_SOURCE preview --force|supabase"));
  assert.equal(lines.length, 1 + 2 * Object.keys(GOOD_ENV).length);
});
