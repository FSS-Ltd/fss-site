import { test } from "node:test";
import assert from "node:assert/strict";
import { signPreview, verifyPreview } from "./preview-token";
import { JourneyConflict } from "./command-types";
test("preview envelope retains exact bytes and rejects tampering or another key", () => {
  const key = Buffer.alloc(32, 1);
  const token = signPreview({ pdf: "exact" }, key);
  assert.deepEqual(verifyPreview(token, key), { pdf: "exact" });
  assert.throws(
    () => verifyPreview(token, Buffer.alloc(32, 2)),
    JourneyConflict,
  );
  assert.throws(() => verifyPreview(token + "x", key), JourneyConflict);
});
