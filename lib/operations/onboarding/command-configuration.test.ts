import test from "node:test";
import assert from "node:assert/strict";
import { journeyCommandOptions } from "./command-configuration";
import { JourneyConflict } from "./command-types";
test("controls do not load provider configuration; preview configuration errors are typed", () => {
  const options = journeyCommandOptions({});
  assert.ok(options);
  assert.throws(
    () => options.previewKey,
    (error) =>
      error instanceof JourneyConflict && error.code === "configuration",
  );
  assert.equal(options.billing, null);
});
