import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMERCIAL_STAGES,
  COMMERCIAL_STAGES_THAT_STOP_OUTREACH,
  COMMERCIAL_TRANSITIONS,
  DELIVERY_STATUSES,
  DELIVERY_TRANSITIONS,
  isPermittedCommercialTransition,
  isPermittedDeliveryTransition,
  permittedCommercialTargets,
  permittedDeliveryTargets,
  type CommercialStage,
  type DeliveryStatus,
} from "./stages";

test("every commercial stage has a transition table entry", () => {
  assert.deepEqual(
    Object.keys(COMMERCIAL_TRANSITIONS).sort(),
    [...COMMERCIAL_STAGES].sort(),
  );
});

test("every delivery status has a transition table entry", () => {
  assert.deepEqual(
    Object.keys(DELIVERY_TRANSITIONS).sort(),
    [...DELIVERY_STATUSES].sort(),
  );
});

test("commercial stages move forward one step or drop to lost", () => {
  assert.deepEqual(permittedCommercialTargets("new"), ["qualified", "lost"]);
  assert.deepEqual(permittedCommercialTargets("qualified"), [
    "proposal",
    "lost",
  ]);
  assert.deepEqual(permittedCommercialTargets("proposal"), [
    "negotiation",
    "lost",
  ]);
  assert.deepEqual(permittedCommercialTargets("negotiation"), [
    "won",
    "lost",
  ]);
});

test("won and lost are commercial dead ends", () => {
  assert.deepEqual(permittedCommercialTargets("won"), []);
  assert.deepEqual(permittedCommercialTargets("lost"), []);
});

test("a commercial stage cannot skip ahead", () => {
  assert.equal(isPermittedCommercialTransition("new", "negotiation"), false);
  assert.equal(isPermittedCommercialTransition("new", "won"), false);
  assert.equal(isPermittedCommercialTransition("qualified", "won"), false);
});

test("every open commercial stage can drop to lost", () => {
  for (const stage of ["new", "qualified", "proposal", "negotiation"] as const) {
    assert.equal(isPermittedCommercialTransition(stage, "lost"), true);
  }
});

test("delivery statuses move forward one step or cancel", () => {
  assert.deepEqual(permittedDeliveryTargets("not_started"), [
    "discovery",
    "cancelled",
  ]);
  assert.deepEqual(permittedDeliveryTargets("discovery"), [
    "build",
    "cancelled",
  ]);
  assert.deepEqual(permittedDeliveryTargets("build"), ["review", "cancelled"]);
  assert.deepEqual(permittedDeliveryTargets("review"), [
    "complete",
    "cancelled",
  ]);
});

test("complete can only advance to support, never cancel", () => {
  assert.deepEqual(permittedDeliveryTargets("complete"), ["support"]);
  assert.equal(isPermittedDeliveryTransition("complete", "cancelled"), false);
});

test("support and cancelled are delivery dead ends", () => {
  assert.deepEqual(permittedDeliveryTargets("support"), []);
  assert.deepEqual(permittedDeliveryTargets("cancelled"), []);
});

test("a delivery status cannot skip ahead", () => {
  assert.equal(isPermittedDeliveryTransition("not_started", "build"), false);
  assert.equal(isPermittedDeliveryTransition("discovery", "complete"), false);
});

test("every permitted commercial target stops active outreach", () => {
  for (const stage of COMMERCIAL_STAGES) {
    for (const target of permittedCommercialTargets(stage)) {
      assert.equal(
        COMMERCIAL_STAGES_THAT_STOP_OUTREACH.has(target),
        true,
        `expected leaving "${stage}" for "${target}" to stop outreach`,
      );
    }
  }
});

test("new is the only stage not in the outreach-stopping set", () => {
  const stopping = new Set<CommercialStage>(COMMERCIAL_STAGES_THAT_STOP_OUTREACH);
  assert.equal(stopping.has("new"), false);
  for (const stage of COMMERCIAL_STAGES) {
    if (stage === "new") continue;
    assert.equal(stopping.has(stage), true);
  }
});

test("delivery statuses are exhaustively typed", () => {
  const allStatuses: DeliveryStatus[] = [...DELIVERY_STATUSES];
  assert.equal(allStatuses.length, 7);
});
