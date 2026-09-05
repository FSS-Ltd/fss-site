import assert from "node:assert/strict";
import test from "node:test";

import { scrollLinkedWalkthroughHeightClass } from "./property-walkthrough-hero";

test("gives the exterior-to-interior walkthrough four viewport-heights of scroll", () => {
  assert.equal(scrollLinkedWalkthroughHeightClass, "h-[500svh]");
});
