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

const { StageTransitionFormFrame } =
  require("./stage-transition-form") as typeof import("./stage-transition-form");

const ENGAGEMENT_ID = "11111111-1111-4111-8111-111111111111";

function renderForm(
  currentStage: "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost",
): string {
  return renderToStaticMarkup(
    <StageTransitionFormFrame
      currentStage={currentStage}
      engagementId={ENGAGEMENT_ID}
      onSuccess={() => {}}
      version={3}
    />,
  );
}

test("a new engagement offers moves to qualified or lost", () => {
  const html = renderForm("new");
  assert.match(html, />Move to Qualified<\/button>/);
  assert.match(html, />Move to Lost<\/button>/);
  assert.doesNotMatch(html, />Move to Proposal<\/button>/);
});

test("a qualified engagement offers moves to proposal or lost", () => {
  const html = renderForm("qualified");
  assert.match(html, />Move to Proposal<\/button>/);
  assert.match(html, />Move to Lost<\/button>/);
});

test("a negotiation engagement offers moves to won or lost", () => {
  const html = renderForm("negotiation");
  assert.match(html, />Move to Won<\/button>/);
  assert.match(html, />Move to Lost<\/button>/);
});

test("won and lost are dead ends with no move action rendered", () => {
  assert.equal(renderForm("won"), "");
  assert.equal(renderForm("lost"), "");
});

test("the action group is labelled with the current stage", () => {
  const html = renderForm("proposal");
  assert.match(html, /aria-label="Move Proposal opportunity"/);
});
