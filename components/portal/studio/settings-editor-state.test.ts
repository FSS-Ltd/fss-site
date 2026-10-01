import assert from "node:assert/strict";
import test from "node:test";
import { defaultActiveStudioSettings } from "@/lib/operations/studio/active-settings-types";
import {
  createSettingsEditorState,
  settingsEditorReducer,
  settingsEditorDirty,
  settingsSectionUpdate,
} from "./settings-editor-state";

test("failed applies retain edited values and failed status while pending prevents double submits", () => {
  const initial = createSettingsEditorState(defaultActiveStudioSettings);
  const editing = settingsEditorReducer(initial, {
    type: "edit",
    section: "identity",
  });
  const changed = settingsEditorReducer(editing, {
    type: "change",
    values: { displayName: "Edited FSS" },
  });
  assert.equal(settingsEditorDirty(changed), true);
  assert.deepEqual(settingsSectionUpdate(changed), {
    section: "identity",
    expectedRevision: 0,
    values: { displayName: "Edited FSS" },
  });
  const pending = settingsEditorReducer(changed, { type: "pending" });
  assert.equal(pending.status, "pending");
  assert.deepEqual(
    settingsEditorReducer(pending, { type: "edit", section: "delivery" }),
    pending,
  );
  const failed = settingsEditorReducer(pending, {
    type: "error",
    message: "Try again",
  });
  assert.equal(failed.values.displayName, "Edited FSS");
  assert.equal(failed.status, "error");
  assert.equal(settingsEditorDirty(failed), true);
});

test("conflicts require explicit review before reusing the current revision and preserve entered values", () => {
  let state = settingsEditorReducer(
    createSettingsEditorState(defaultActiveStudioSettings),
    { type: "edit", section: "communication" },
  );
  state = settingsEditorReducer(state, {
    type: "change",
    values: { responseExpectationHours: 24 },
  });
  const current = {
    ...defaultActiveStudioSettings,
    displayName: "Someone else's Studio",
    revision: 8,
  };
  state = settingsEditorReducer(state, {
    type: "conflict",
    current,
    message: "Review applied settings",
  });
  assert.equal(settingsSectionUpdate(state)?.expectedRevision, 0);
  assert.equal(state.status, "conflict");
  state = settingsEditorReducer(state, { type: "review-conflict" });
  assert.equal(settingsSectionUpdate(state)?.expectedRevision, 8);
  assert.equal(state.values.responseExpectationHours, 24);
  assert.equal(state.active.displayName, current.displayName);
  const saved = { ...current, responseExpectationHours: 24, revision: 9 };
  state = settingsEditorReducer(state, { type: "applied", active: saved });
  assert.equal(settingsEditorDirty(state), false);
  assert.equal(state.section, null);
  assert.equal(state.status, "success");
  assert.equal(state.active.revision, 9);
});

test("closing a dirty editor requires an explicit discard, and each section emits only its own values", () => {
  let state = settingsEditorReducer(
    createSettingsEditorState(defaultActiveStudioSettings),
    { type: "edit", section: "timezone" },
  );
  state = settingsEditorReducer(state, {
    type: "change",
    values: { timezone: "America/New_York" },
  });
  assert.equal(settingsSectionUpdate(state)?.section, "timezone");
  assert.deepEqual(settingsEditorReducer(state, { type: "close" }), state);
  state = settingsEditorReducer(state, { type: "discard" });
  assert.equal(state.values.timezone, "Europe/London");
  assert.equal(settingsEditorDirty(state), false);
  state = settingsEditorReducer(state, { type: "edit", section: "delivery" });
  assert.deepEqual(settingsSectionUpdate(state), {
    section: "delivery",
    expectedRevision: 0,
    values: { deliveryCapacity: "standard" },
  });
});
