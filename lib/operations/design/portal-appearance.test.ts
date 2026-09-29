import assert from "node:assert/strict";
import test from "node:test";
import { isPortalAppearance } from "./portal-appearance";

test("accepts only supported portal appearances", () => {
  assert.equal(isPortalAppearance("system"), true);
  assert.equal(isPortalAppearance("light"), true);
  assert.equal(isPortalAppearance("dark"), true);
  assert.equal(isPortalAppearance("contrast"), false);
  assert.equal(isPortalAppearance(undefined), false);
});
