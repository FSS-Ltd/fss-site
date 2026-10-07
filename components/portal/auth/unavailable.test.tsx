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

const { PortalUnavailable } =
  require("./unavailable") as typeof import("./unavailable");

test("gives an unavailable workspace a safe retry route and support reference", () => {
  const html = renderToStaticMarkup(
    <PortalUnavailable
      reference="FSS-DEMO-042"
      retryHref="/portal?organisationId=11111111-1111-4111-8111-111111111111"
    />,
  );

  assert.match(html, /We couldn.t load this page/);
  assert.match(html, /FSS-DEMO-042/);
  assert.match(html, /Try again/);
});

test("a page load failure does not claim the entire portal is down", () => {
  const html = renderToStaticMarkup(<PortalUnavailable />);
  assert.doesNotMatch(html, /portal is temporarily unavailable/);
  assert.match(html, /couldn.t load this page/);
  assert.match(html, /Get help/);
});
