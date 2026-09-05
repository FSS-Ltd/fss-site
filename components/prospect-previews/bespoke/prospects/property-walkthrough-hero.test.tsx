import assert from "node:assert/strict";
import test from "node:test";

import {
  scrollLinkedWalkthroughHeightClass,
  shouldEnablePropertyWalkthrough,
} from "./property-walkthrough-hero";

test("uses Stagg's desktop scroll activation rule for the shared walkthrough", () => {
  assert.equal(shouldEnablePropertyWalkthrough(false, 1280), true);
  assert.equal(shouldEnablePropertyWalkthrough(true, 1280), false);
  assert.equal(shouldEnablePropertyWalkthrough(false, 767), false);
});

test("gives the exterior-to-interior walkthrough four viewport-heights of scroll", () => {
  assert.equal(scrollLinkedWalkthroughHeightClass, "h-[500svh]");
});
