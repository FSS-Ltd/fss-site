import assert from "node:assert/strict";
import test from "node:test";
import { parseCommittedCoverageId } from "./gmail-due-context";

test("accepts only a UUID or null for the current committed coverage", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(parseCommittedCoverageId(id), id);
  assert.equal(parseCommittedCoverageId(null), null);
  for (const value of ["not-a-uuid", "", undefined, 5, {}])
    assert.throws(() => parseCommittedCoverageId(value));
});
