import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { generateReadinessKit } from "./generate-readiness-kit";

test("readiness workbook is deterministic, four pages and matches the published asset", async () => {
  const first = await generateReadinessKit();
  const second = await generateReadinessKit();
  assert.deepEqual(first, second);
  assert.equal(first.subarray(0, 5).toString(), "%PDF-");
  assert.equal(
    (first.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
    4,
  );
  assert.deepEqual(
    first,
    await readFile(
      "public/resource-downloads/software-project-readiness-kit.pdf",
    ),
  );
});
