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

const { DealActionsFrame } =
  require("./deal-actions") as typeof import("./deal-actions");

const ENGAGEMENT_ID = "11111111-1111-4111-8111-111111111111";
const PROSPECT_ID = "22222222-2222-4222-8222-222222222222";

function renderActions(overrides: {
  stage?: "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  currentNextAction?: string | null;
  currentNextActionDueAt?: string | null;
} = {}): string {
  return renderToStaticMarkup(
    <DealActionsFrame
      currentNextAction={overrides.currentNextAction ?? null}
      currentNextActionDueAt={overrides.currentNextActionDueAt ?? null}
      engagementId={ENGAGEMENT_ID}
      engagementVersion={4}
      onSuccess={() => {}}
      prospectId={PROSPECT_ID}
      prospectVersion={7}
      stage={overrides.stage ?? "proposal"}
    />,
  );
}

test("renders the stage-transition moves for the current stage", () => {
  const html = renderActions({ stage: "proposal" });
  assert.match(html, />Move to Negotiation<\/button>/);
  assert.match(html, />Move to Lost<\/button>/);
});

test("renders no stage moves once won or lost", () => {
  assert.doesNotMatch(renderActions({ stage: "won" }), />Move to/);
  assert.doesNotMatch(renderActions({ stage: "lost" }), />Move to/);
});

test("pre-fills the next-step field with the current next action", () => {
  const html = renderActions({
    currentNextAction: "Send proposal",
    currentNextActionDueAt: "2026-08-25T09:00:00.000Z",
  });
  assert.match(html, /value="Send proposal"/);
  assert.match(html, /value="2026-08-25"/);
});

test("the save button is disabled until both fields are filled", () => {
  const html = renderActions({ currentNextAction: null, currentNextActionDueAt: null });
  assert.match(html, /<button[^>]*disabled=""[^>]*>\s*Save next step<\/button>/);
});

test("the save button is enabled once a next step and due date are pre-filled", () => {
  const html = renderActions({
    currentNextAction: "Send proposal",
    currentNextActionDueAt: "2026-08-25T09:00:00.000Z",
  });
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Save next step<\/button>/,
  );
});
