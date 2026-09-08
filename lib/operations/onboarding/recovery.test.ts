import { test } from "node:test";
import assert from "node:assert/strict";
import { canReconcile, jobExplanation } from "./recovery";
import type { JourneyJob, JourneyView } from "./command-types";
const job: JourneyJob = {
  id: "x",
  step: "thank_you",
  recipient: "a@example.test",
  state: "pending",
  dueAt: "2026-09-08",
  attempts: 0,
  failureCode: null,
  uncertain: false,
  providerId: null,
  acceptedAt: null,
};
const journey = {
  state: "active",
  jobs: [{ ...job, step: "invoice", state: "held" }],
} as JourneyView;
test("failed dependencies explain why thanks is waiting", () =>
  assert.match(
    jobExplanation(job, journey),
    /first invoice and all approved portal access/,
  ));
test("cancelled in-flight acceptance never claims unsent", () =>
  assert.match(
    jobExplanation(
      { ...job, providerId: "accepted" },
      { ...journey, state: "cancelled" },
    ),
    /cannot unsend/,
  ));
test("only unresolved acceptance has reconciliation control", () => {
  assert.equal(canReconcile(job), false);
  assert.equal(canReconcile({ ...job, uncertain: true }), true);
  assert.equal(
    canReconcile({ ...job, uncertain: true, providerId: "known" }),
    false,
  );
});
