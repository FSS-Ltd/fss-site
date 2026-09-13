import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { BillingExceptionList } =
  require("./exception-list") as typeof import("./exception-list");
test("billing review provides recoverable error and empty states", () => {
  const error = renderToStaticMarkup(
    <BillingExceptionList state={{ status: "error" }} />,
  );
  assert.match(error, /role="alert"/);
  assert.match(error, /Try again/);
  const empty = renderToStaticMarkup(
    <BillingExceptionList
      state={{ status: "ready", rows: [], nextCursor: null }}
    />,
  );
  assert.match(empty, /No open items/);
});
test("unmapped payment exceptions remain visible without inventing a client link", () => {
  const html = renderToStaticMarkup(
    <BillingExceptionList
      state={{
        status: "ready",
        nextCursor: null,
        rows: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            organisationId: null,
            organisationName: null,
            category: "unknown_mapping",
            objectId: "in_synthetic",
            mode: "test",
            createdAt: "2026-09-08T10:00:00Z",
            lastSeenAt: "2026-09-08T10:00:00Z",
          },
        ],
      }}
    />,
  );
  assert.match(html, /1 open billing exception on this page/);
  assert.doesNotMatch(html, /<main\b/);
  assert.match(html, /Client mapping needed/);
  assert.match(html, /data-status="test">Test<\/span>/);
  assert.match(html, /Match this provider record/);
  assert.doesNotMatch(html, /Review client agreements/);
});
