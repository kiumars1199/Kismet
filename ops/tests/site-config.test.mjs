// Runs on a temp copy of config/site.json; the repo's copy is never written.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { apply, today } from "../site-config.mjs";
import { ROOT } from "../lib.mjs";

const repoSite = () => JSON.parse(readFileSync(join(ROOT, "config/site.json"), "utf8"));

test("apply: sets known leaves, stamps last_updated, rejects unknown keys and wrong types", () => {
  const now = new Date(2026, 10, 18);
  const { site, changes } = apply(repoSite(), { "legal.governing_state": "Delaware" }, now);
  assert.equal(site.legal.governing_state, "Delaware");
  assert.equal(site.legal.last_updated, "November 18, 2026");
  assert.equal(changes.length, 2);
  assert.equal(today(now), "November 18, 2026");
  assert.throws(() => apply(repoSite(), { "legal.nope": "x" }), /unknown setting/);
  assert.throws(() => apply(repoSite(), { legal: "x" }), /unknown setting/);
  assert.throws(() => apply(repoSite(), { "prices_usd.pro_monthly": "19" }), /must be a number/);
  assert.equal(apply(site, { "legal.governing_state": "Delaware" }, now).changes.length, 0, "same value twice = no change");
});

test("CLI: dry run by default, --yes writes, invalid values refused, second run is a no-op", () => {
  const dir = mkdtempSync(join(tmpdir(), "me-site-"));
  const file = join(dir, "site.json");
  copyFileSync(join(ROOT, "config/site.json"), file);
  const original = readFileSync(file, "utf8");
  const flags = ["--domain", "marketedge.example", "--support-email", "help@marketedge.example", "--operator-names", "A and B",
    "--state", "Delaware", "--refund-policy", "first_charge_7_days", "--response-time", "2 business days", "--address", "1 Main St"];
  const run = (...a) => execFileSync("node", [join(ROOT, "ops/site-config.mjs"), "--file", file, ...a], { encoding: "utf8", stdio: "pipe" });

  assert.match(run(...flags), /Dry run[\s\S]*domain: "" → "marketedge.example"/);
  assert.equal(readFileSync(file, "utf8"), original);

  assert.throws(() => run("--domain", "https://bad.example/x", "--yes"), (e) => e.status === 1 && /INVALID {2}domain/.test(e.stdout));
  assert.throws(() => run("--bogus", "x"), (e) => e.status === 2);
  assert.equal(readFileSync(file, "utf8"), original);

  run(...flags, "--yes");
  const site = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(site.legal.operator_names, "A and B");
  assert.ok(site.legal.last_updated, "last_updated stamped");
  assert.deepEqual(site.prices_usd, repoSite().prices_usd, "prices untouched");
  assert.match(run(...flags, "--yes"), /no changes/);

  writeFileSync(join(dir, "owner.json"), JSON.stringify({ stripe: { mode: "links", paymentLinks: { pro_monthly: "https://buy.stripe.com/a" } } }));
  assert.throws(() => run("--from", join(dir, "owner.json"), "--yes"), (e) => /INVALID {2}stripe.paymentLinks.pro_yearly/.test(e.stdout), "links mode needs all 4");
});
