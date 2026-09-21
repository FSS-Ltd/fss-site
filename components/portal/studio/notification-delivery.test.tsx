import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
};

const { NotificationDelivery } = require("./notification-delivery") as typeof import("./notification-delivery");

test("renders per-delivery evidence and a held-delivery filter", () => {
  const html = renderToStaticMarkup(
    <NotificationDelivery
      data={{
        hasNext: false,
        items: [
          {
            attempts: 2,
            id: "55555555-5555-4555-8555-555555555555",
            kind: "review_requested",
            lastError: "provider_timeout",
            nextAttemptAt: "2026-09-22T10:00:00.000Z",
            organisationId: "44444444-4444-4444-8444-444444444444",
            organisationName: "Elm & Co",
            recipientLabel: "a***@elm.example",
            requestId: "66666666-6666-4666-8666-666666666666",
            requestTitle: "Approve updated booking flow",
            status: "pending",
            updatedAt: "2026-09-21T10:00:00.000Z",
          },
        ],
        page: 1,
      }}
      selectedStatus="retry"
    />,
  );

  assert.match(html, /Notification delivery/);
  assert.match(html, /a\*\*\*@elm\.example/);
  assert.match(html, /provider timeout/);
  assert.match(html, /Needs attention/);
  assert.doesNotMatch(html, /Replay journey/);
});
