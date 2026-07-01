import assert from "node:assert/strict";
import test from "node:test";

import {
  getShowcaseLayoutState,
  getShowcaseScrollState,
} from "./showcase-progress";

test("keeps the showcase quiet at initial section entry", () => {
  const state = getShowcaseScrollState(0.03, 4);

  assert.equal(state.activeFeatureIndex, 0);
  assert.equal(state.phoneProgress, 0);
});

test("keeps the phone hidden during the early pinned hold", () => {
  const state = getShowcaseScrollState(0.17, 4);

  assert.equal(state.activeFeatureIndex, 0);
  assert.equal(state.phoneProgress, 0);
});

test("reveals the phone while the content remains pinned", () => {
  const state = getShowcaseScrollState(0.45, 4);

  assert.equal(state.activeFeatureIndex, 1);
  assert.ok(state.phoneProgress > 0);
  assert.ok(state.phoneProgress < 1);
});

test("reaches the final feature before the next section enters", () => {
  const state = getShowcaseScrollState(0.85, 4);

  assert.equal(state.activeFeatureIndex, 3);
  assert.equal(state.phoneProgress, 1);
});

test("clamps invalid progress and empty feature lists", () => {
  assert.deepEqual(getShowcaseScrollState(-1, 0), {
    activeFeatureIndex: -1,
    phoneProgress: 0,
    progress: 0,
  });
  assert.deepEqual(getShowcaseScrollState(2, 4), {
    activeFeatureIndex: 3,
    phoneProgress: 1,
    progress: 1,
  });
});

test("uses a parent-height sticky scene on desktop", () => {
  assert.deepEqual(getShowcaseLayoutState(1200), {
    mobileShowcase: false,
    mobileVisualDisplay: "none",
    sectionMinHeight: "",
    spacerHeight: "90vh",
    stageDisplay: "block",
    stageGridTemplateColumns: "1fr 1fr",
    stickyHeight: "100svh",
    stickyPosition: "sticky",
  });
});

test("falls back to a static stacked showcase on mobile", () => {
  assert.deepEqual(getShowcaseLayoutState(720), {
    mobileShowcase: true,
    mobileVisualDisplay: "block",
    sectionMinHeight: "",
    spacerHeight: "0",
    stageDisplay: "none",
    stageGridTemplateColumns: "1fr",
    stickyHeight: "auto",
    stickyPosition: "static",
  });
});
