import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
};
const { JourneyRecovery } = require("./journey-recovery") as typeof import("./journey-recovery");

test("keeps journey activation disabled while retained preflight checks fail", () => {
  const html = renderToStaticMarkup(
    <JourneyRecovery
      recovery={{
        canStart: false,
        checks: [
          { href: null, id: "contact", reason: "Ready.", status: "passed" },
          { href: "/portal/admin/agreements", id: "agreement", reason: "Refresh the current agreement before starting this journey.", status: "needs_action" },
        ],
        draftId: "44444444-4444-4444-8444-444444444444",
        organisationId: "55555555-5555-4555-8555-555555555555",
        organisationName: "Northstar Studio",
        updatedAt: "2026-09-21T10:00:00.000Z",
      }}
    />,
  );

  assert.match(html, /Two things need your attention/);
  assert.match(html, /Refresh the current agreement/);
  assert.match(html, /Open agreement/);
  assert.match(html, /disabled/);
});
