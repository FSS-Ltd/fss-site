import assert from "node:assert/strict";
import test from "node:test";
import {
  fssStudioEnabled,
  growthOperationsCutoverEnabled,
  prefixFreePortalEnabled,
} from "./release-flags";

test("portal routing and Studio require explicit production enablement", () => {
  const production = { NODE_ENV: "production" };

  assert.equal(prefixFreePortalEnabled(production), false);
  assert.equal(fssStudioEnabled(production), false);
  assert.equal(
    prefixFreePortalEnabled({
      ...production,
      OPERATIONS_PORTAL_PREFIX_FREE_ENABLED: "true",
    }),
    true,
  );
  assert.equal(
    fssStudioEnabled({
      ...production,
      OPERATIONS_FSS_STUDIO_ENABLED: "true",
    }),
    true,
  );
});

test("local development retains the established portal and Studio routes", () => {
  const development = { NODE_ENV: "development" };

  assert.equal(prefixFreePortalEnabled(development), true);
  assert.equal(fssStudioEnabled(development), true);
});

test("the Growth cutover requires both the Studio and cutover flags", () => {
  const production = { NODE_ENV: "production" };

  assert.equal(growthOperationsCutoverEnabled(production), false);
  assert.equal(
    growthOperationsCutoverEnabled({
      ...production,
      OPERATIONS_FSS_STUDIO_ENABLED: "true",
    }),
    false,
  );
  assert.equal(
    growthOperationsCutoverEnabled({
      ...production,
      OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED: "true",
    }),
    false,
  );
  assert.equal(
    growthOperationsCutoverEnabled({
      ...production,
      OPERATIONS_FSS_STUDIO_ENABLED: "true",
      OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED: "true",
    }),
    true,
  );
});
