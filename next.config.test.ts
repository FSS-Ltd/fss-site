import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "./next.config";

test("loads PDFKit through Node.js for server routes", () => {
  assert.ok(nextConfig.serverExternalPackages?.includes("pdfkit"));
});
