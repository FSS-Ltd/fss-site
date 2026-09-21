import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalNotification } from "@/lib/operations/workspaces/types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientNotificationInbox } =
  require("./client-notification-inbox") as typeof import("./client-notification-inbox");

const review: PortalNotification = {
  body: "Your decision is needed before delivery can continue.",
  createdAt: "2026-09-21T10:30:00.000Z",
  id: "11111111-1111-4111-8111-111111111111",
  kind: "review_requested",
  readAt: null,
  requestId: "22222222-2222-4222-8222-222222222222",
  requestVersion: 3,
  title: "Booking flow v3",
};

test("presents an action-needed notification with its authorised request route", () => {
  const html = renderToStaticMarkup(
    <ClientNotificationInbox
      filter="action_needed"
      notifications={[review]}
      organisationId="33333333-3333-4333-8333-333333333333"
    />,
  );

  assert.match(html, /Action needed/);
  assert.match(html, /Booking flow v3/);
  assert.match(
    html,
    /\/requests\/22222222-2222-4222-8222-222222222222\?organisationId=33333333-3333-4333-8333-333333333333/,
  );
  assert.match(html, /Mark 1 notification as read/);
});
