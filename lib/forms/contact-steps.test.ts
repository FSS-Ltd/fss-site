import assert from "node:assert/strict";
import test from "node:test";
import {
  contactFlowReducer,
  initialContactFlow,
  type ContactFlowAction,
} from "./contact-steps";

const run = (...actions: ContactFlowAction[]) =>
  actions.reduce(contactFlowReducer, initialContactFlow);

test("choosing a single-select answer advances one step", () => {
  const state = run({ type: "choose-need", value: "Reporting" });
  assert.equal(state.step, 1);
  assert.equal(state.answers.need, "Reporting");
});

test("next is blocked with a message until a required answer is chosen", () => {
  const blocked = run({ type: "next" });
  assert.equal(blocked.step, 0);
  assert.match(blocked.error ?? "", /continue/);
  const cleared = contactFlowReducer(blocked, {
    type: "choose-need",
    value: "Custom software",
  });
  assert.equal(cleared.error, null);
  assert.equal(cleared.step, 1);
});

test("tools are skippable and toggle on and off", () => {
  const state = run(
    { type: "choose-need", value: "Reporting" },
    { type: "toggle-tool", value: "Xero" },
    { type: "toggle-tool", value: "HubSpot" },
    { type: "toggle-tool", value: "Xero" },
  );
  assert.deepEqual(state.answers.tools, ["HubSpot"]);
  assert.equal(state.step, 1);
  assert.equal(contactFlowReducer(state, { type: "next" }).step, 2);
  assert.equal(
    run({ type: "choose-need", value: "Reporting" }, { type: "next" }).step,
    2,
  );
});

test("back never loses answers and stops at the first step", () => {
  const state = run(
    { type: "set-detail", value: "Invoices" },
    { type: "choose-need", value: "Admin and data entry" },
    { type: "next" },
    { type: "choose-team", value: "Just me" },
    { type: "back" },
    { type: "back" },
    { type: "back" },
    { type: "back" },
  );
  assert.equal(state.step, 0);
  assert.equal(state.answers.need, "Admin and data entry");
  assert.equal(state.answers.detail, "Invoices");
  assert.equal(state.answers.teamSize, "Just me");
});

test("flow reaches the contact step and never passes it", () => {
  const state = run(
    { type: "choose-need", value: "Not sure yet" },
    { type: "next" },
    { type: "choose-team", value: "11 to 50" },
    { type: "choose-timing", value: "Just exploring" },
    { type: "next" },
  );
  assert.equal(state.step, 4);
});

test("team size and timing are required to move on", () => {
  const atTeam = run(
    { type: "choose-need", value: "Reporting" },
    { type: "next" },
    { type: "next" },
  );
  assert.equal(atTeam.step, 2);
  assert.ok(atTeam.error);
});
