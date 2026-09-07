import assert from "node:assert/strict";
import test from "node:test";
import { canTransition } from "./transitions";
import { requestStatuses } from "./types";
const allowed = new Set([
  "new:acknowledged",
  "acknowledged:planned",
  "planned:in_progress",
  "in_progress:ready_for_review",
  "ready_for_review:done",
  "ready_for_review:changes_requested",
  "changes_requested:in_progress",
  "done:acknowledged",
]);
for (const from of requestStatuses)
  for (const to of requestStatuses)
    test(`${from} -> ${to}`, () => {
      assert.equal(
        canTransition(from, to),
        allowed.has(`${from}:${to}`) ||
          (!["done", "cancelled"].includes(from) && to === "cancelled"),
      );
    });
