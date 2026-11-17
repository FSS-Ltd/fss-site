import assert from "node:assert/strict";
import test from "node:test";
import { workspaceDtoSchema } from "./read-workspace";

const observed = {
  id: "o",
  destinationId: "d",
  sourceUrl: "https://facebook.com/page",
  summary: "Public",
  observedAt: "2026-11-17T12:00:00.000Z",
  createdAt: "2026-11-17T12:00:00.000Z",
  provenance: "founder",
};
const destination = {
  id: "d",
  url: "https://facebook.com/page",
  name: "Example",
  kind: "page",
  locality: null,
  websiteUrl: null,
  version: 1,
  observations: [observed],
  observationsHaveMore: false,
  latestObservation: observed,
  review: null,
  postReadiness: "unknown",
  activities: [],
  activitiesHaveMore: false,
  prospects: [],
  prospectsHaveMore: false,
  nextManualAction: "follow",
};
const payload = {
  status: "ready",
  destinations: [destination],
  nextCursor: null,
  historyLimit: 20,
  pilots: { total: 2, used: 0, remaining: 2, allocations: [] },
};
test("accepts the serialized reader shape and rejects malformed nested fields", () => {
  assert.equal(workspaceDtoSchema.safeParse(payload).success, true);
  assert.equal(
    workspaceDtoSchema.safeParse({
      ...payload,
      destinations: [{ ...destination, version: 0 }],
    }).success,
    false,
  );
  assert.equal(
    workspaceDtoSchema.safeParse({
      ...payload,
      destinations: [
        {
          ...destination,
          observations: [{ ...observed, observedAt: "yesterday" }],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    workspaceDtoSchema.safeParse({
      ...payload,
      destinations: [{ ...destination, url: "javascript:alert(1)" }],
    }).success,
    false,
  );
});
