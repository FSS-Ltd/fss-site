import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { CookieConsentPanel } =
  require("./cookie-consent-panel") as typeof import("./cookie-consent-panel");

test("renders an accessible, non-blocking analytics consent region", () => {
  const html = renderToStaticMarkup(
    <CookieConsentPanel onAccept={() => {}} onReject={() => {}} />,
  );

  assert.doesNotMatch(html, /role="dialog"/);
  assert.match(html, /aria-label="Analytics consent"/);
  assert.match(html, /aria-labelledby="cookie-consent-title"/);
  assert.match(html, /aria-describedby="cookie-consent-description"/);
  assert.match(html, /id="cookie-consent-title"/);
  assert.match(html, /id="cookie-consent-description"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /<button[^>]*>Reject analytics<\/button>/);
  assert.match(html, /<button[^>]*>Accept analytics<\/button>/);
});
