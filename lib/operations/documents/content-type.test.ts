import assert from "node:assert/strict";
import test from "node:test";
import { matchesDocumentContentType } from "./content-type";
const bytes = (text: string) => new TextEncoder().encode(text);
test("download signatures reject mislabeled executable, HTML, SVG and binary content", () => {
  assert.equal(
    matchesDocumentContentType(
      bytes("A reviewed delivery note."),
      "text/plain",
    ),
    true,
  );
  for (const content of [
    "<html>unsafe</html>",
    "<svg></svg>",
    "MZ executable",
    "#!/bin/sh",
    "\u0000binary",
    "<?xml version='1.0'?><svg/>",
  ])
    assert.equal(
      matchesDocumentContentType(bytes(content), "text/plain"),
      false,
    );
  assert.equal(
    matchesDocumentContentType(new Uint8Array([255, 254]), "text/plain"),
    false,
  );
  assert.equal(
    matchesDocumentContentType(bytes("<html>unsafe</html>"), "application/pdf"),
    false,
  );
  assert.equal(
    matchesDocumentContentType(
      bytes("%PDF-1.7\nsynthetic\n%%EOF\n"),
      "application/pdf",
    ),
    true,
  );
  assert.equal(
    matchesDocumentContentType(
      new Uint8Array([255, 216, 255, 255, 217]),
      "image/jpeg",
    ),
    true,
  );
  assert.equal(matchesDocumentContentType(bytes("wrong"), "image/jpeg"), false);
  assert.equal(
    matchesDocumentContentType(
      new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66,
        96, 130,
      ]),
      "image/png",
    ),
    true,
  );
  assert.equal(matchesDocumentContentType(bytes("wrong"), "image/png"), false);
});
