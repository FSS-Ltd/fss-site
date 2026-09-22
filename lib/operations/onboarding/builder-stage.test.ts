import assert from "node:assert/strict";
import test from "node:test";
import { isJourneyBuilderStage } from "./builder-stage";

test("accepts journey builder stages and rejects unknown query values", () => {
  for (const stage of ["setup", "content", "access", "schedule", "activate"])
    assert.equal(isJourneyBuilderStage(stage), true);

  assert.equal(isJourneyBuilderStage(undefined), false);
  assert.equal(isJourneyBuilderStage("unknown"), false);
});
