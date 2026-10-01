import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("welcome validation loads under React server conditions without importing email rendering", () => {
  const schemaPath = fileURLToPath(
    new URL("./approval-schema.ts", import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=commonjs",
      "--eval",
      `const { welcomeInputSchema } = require(${JSON.stringify(schemaPath)}); if (typeof welcomeInputSchema.parse !== "function") throw new Error("Missing welcome validation");`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
