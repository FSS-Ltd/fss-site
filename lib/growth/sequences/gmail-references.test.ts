import assert from "node:assert/strict";
import test from "node:test";
import { parseGmailReferences } from "./gmail-references";

test("parses complete exact reference tokens without changing case or accepting a bad tail", () => {
  assert.deepEqual(parseGmailReferences(null, null), { kind: "missing" });
  assert.deepEqual(
    parseGmailReferences(
      "<A@Example.test>",
      "<A@Example.test>\r\n <b@example.test>",
    ),
    { kind: "valid", ids: ["<A@Example.test>", "<b@example.test>"] },
  );
  assert.deepEqual(
    parseGmailReferences("<a@example.test>", "<b@example.test> trailing"),
    { kind: "malformed" },
  );
  assert.deepEqual(parseGmailReferences("", null), { kind: "malformed" });
  assert.deepEqual(parseGmailReferences(null, "x".repeat(16385)), {
    kind: "over_limit",
  });
  assert.deepEqual(
    parseGmailReferences(
      null,
      Array.from({ length: 101 }, (_, i) => `<${i}@example.test>`).join(" "),
    ),
    { kind: "over_limit" },
  );
});
