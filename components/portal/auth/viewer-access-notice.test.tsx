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

const { ViewerAccessNotice } =
  require("./viewer-access-notice") as typeof import("./viewer-access-notice");

test("viewer access presents only safe read and access-help routes", () => {
  const html = renderToStaticMarkup(
    <ViewerAccessNotice organisationId="11111111-1111-4111-8111-111111111111" />,
  );

  assert.match(html, /View projects/);
  assert.match(html, /Get access help/);
  assert.doesNotMatch(html, /<button[^>]*>Invite/);
});
