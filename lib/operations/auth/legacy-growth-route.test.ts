import assert from "node:assert/strict";
import test from "node:test";
import { retiredGrowthOperationsResponse } from "./legacy-growth-route";

test("a completed Studio cutover retires the legacy Growth workflow endpoints", () => {
  const response = retiredGrowthOperationsResponse(true);

  assert.equal(response?.status, 404);
  assert.equal(response?.headers.get("Cache-Control"), "private, no-store");
  assert.equal(retiredGrowthOperationsResponse(false), null);
});
