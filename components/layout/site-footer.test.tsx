import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

// The footer pulls in CSS modules, which plain node cannot load.
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { SiteFooter } = require("./site-footer");

test("offers the privacy notice and a persistent cookie settings control", () => {
  const html = renderToStaticMarkup(<SiteFooter />);

  assert.match(html, /href="\/privacy"/);
  assert.match(html, />Privacy<\/a>/);
  assert.match(html, /<button[^>]*>Cookie settings<\/button>/);
});

test("footer copy avoids em dashes and shares the public page gutter", () => {
  const html = renderToStaticMarkup(<SiteFooter />);

  assert.doesNotMatch(html, /—/);
  assert.match(html, /private AI\. Built faithfully, in the UK\./);
  assert.match(
    html,
    /max\(clamp\(16px, 7\.5vw - 8px, 24px\), calc\(\(100% - 1120px\) \/ 2\)\)/,
  );
});
