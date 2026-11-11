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

const { DeliveryStatusFormFrame } =
  require("./delivery-status") as typeof import("./delivery-status");

const ENGAGEMENT_ID = "11111111-1111-4111-8111-111111111111";

function renderForm(overrides: {
  currentStatus?: Parameters<typeof DeliveryStatusFormFrame>[0]["currentStatus"];
} = {}): string {
  return renderToStaticMarkup(
    <DeliveryStatusFormFrame
      currentStatus={overrides.currentStatus ?? "discovery"}
      engagementId={ENGAGEMENT_ID}
      onSuccess={() => {}}
      version={4}
    />,
  );
}

test("renders the permitted delivery moves for the current status", () => {
  const html = renderForm({ currentStatus: "discovery" });
  assert.match(html, />Move to Build<\/button>/);
  assert.match(html, />Move to Cancelled<\/button>/);
});

test("renders nothing once delivery has reached a terminal status", () => {
  assert.equal(renderForm({ currentStatus: "support" }), "");
  assert.equal(renderForm({ currentStatus: "cancelled" }), "");
});

test("a complete or cancelled delivery can still move to support", () => {
  const html = renderForm({ currentStatus: "complete" });
  assert.match(html, />Move to Support<\/button>/);
  assert.doesNotMatch(html, />Move to Cancelled<\/button>/);
});

test("moving to build or review is a plain button with no confirmation panel rendered", () => {
  const html = renderForm({ currentStatus: "discovery" });
  assert.doesNotMatch(html, /Confirm move to Build/);
});
