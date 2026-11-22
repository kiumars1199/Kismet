// engine/tests/fixtures/taxonomy_ids.json mirrors the taxonomy ids so the Python topic-map test can check against them.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { TAXONOMY } from "@/lib/taxonomy";

const file = path.resolve(process.cwd(), "../../engine/tests/fixtures/taxonomy_ids.json");

it("engine/tests/fixtures/taxonomy_ids.json lists every taxonomy id (UPDATE_TAXONOMY_IDS=1 rewrites it)", () => {
  const ids = Object.keys(TAXONOMY).sort();
  if (process.env.UPDATE_TAXONOMY_IDS) writeFileSync(file, JSON.stringify(ids, null, 0) + "\n");
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(ids);
});
