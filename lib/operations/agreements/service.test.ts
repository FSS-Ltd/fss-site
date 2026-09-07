import assert from "node:assert/strict";
import test from "node:test";
import { assertEditable, agreementCommandSchema } from "./service";

test("signed revisions and stale edits cannot be changed", () => {
  assert.throws(
    () => assertEditable({ status: "signed", version: 2 }, 2),
    /immutable/,
  );
  assert.throws(
    () => assertEditable({ status: "draft", version: 2 }, 1),
    /changed/,
  );
  assert.doesNotThrow(() => assertEditable({ status: "draft", version: 2 }, 2));
  assert.equal(
    agreementCommandSchema.safeParse({ action: "sign", evidence: {} }).success,
    false,
  );
});
