import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
};
const { StudioSettings } = require("./studio-settings") as typeof import("./studio-settings");

test("renders a safe Studio settings draft without provider controls", () => {
  const html = renderToStaticMarkup(
    <StudioSettings
      settings={{
        approvedReplyTo: [],
        draft: { createdAt: "2026-09-21T10:00:00.000Z", deliveryCapacity: "standard", displayName: "Faithful Software Solutions", replyTo: null, responseExpectationHours: 48, revision: 2, timezone: "Europe/London" },
        integrationHealth: [{ available: true, detail: "Identity is deployment-managed.", name: "Authentication" }],
      }}
    />,
  );
  assert.match(html, /Studio identity/);
  assert.match(html, /Save settings draft/);
  assert.match(html, /does not rewrite active approvals/);
  assert.doesNotMatch(html, /Secret key/);
});
