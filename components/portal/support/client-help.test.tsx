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

const { ClientHelp } =
  require("./client-help") as typeof import("./client-help");

test("provides a bounded help request without implying a purchase", () => {
  const html = renderToStaticMarkup(
    <ClientHelp organisationId="11111111-1111-4111-8111-111111111111" />,
  );

  assert.match(html, /How can we help/);
  assert.match(html, /Support topic/);
  assert.match(html, /Create help request/);
  assert.match(html, /does not change your agreement or payment method/);
});
