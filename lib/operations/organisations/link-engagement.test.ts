import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReviewedMapping,
  requireOperationsFounder,
} from "./link-engagement";

const input = {
  reviewReference: "founder-review-2026-09-06",
  organisations: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      legalName: "Example Limited",
      displayName: "Example",
      tradingStatus: "active",
      timezone: "Europe/London",
      engagementIds: [
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    },
  ],
};

test("reviewed mappings preserve explicit multiple engagements for one organisation", () => {
  assert.deepEqual(parseReviewedMapping(input), input);
  assert.deepEqual(parseReviewedMapping(input), parseReviewedMapping(input));
});

test("reviewed mappings reject conflicts, duplicate imports, unknown fields and invalid identities", () => {
  assert.throws(() =>
    parseReviewedMapping({
      ...input,
      organisations: [...input.organisations, ...input.organisations],
    }),
  );
  assert.throws(() =>
    parseReviewedMapping({
      ...input,
      organisations: [
        input.organisations[0],
        {
          ...input.organisations[0],
          id: "44444444-4444-4444-8444-444444444444",
        },
      ],
    }),
  );
  assert.throws(() =>
    parseReviewedMapping({ ...input, autoMatchDomain: true }),
  );
  assert.throws(() => parseReviewedMapping({ ...input, reviewReference: " " }));
  assert.throws(() =>
    parseReviewedMapping({
      ...input,
      organisations: [{ ...input.organisations[0], timezone: "Invalid/Zone" }],
    }),
  );
});

test("founder context rejects missing or unverified actors", () => {
  assert.throws(() => requireOperationsFounder(null));
  assert.throws(() => requireOperationsFounder({ actorId: "arbitrary" }));
  assert.equal(
    requireOperationsFounder({ actorId: "a".repeat(64) }).actorId,
    "a".repeat(64),
  );
});

test("UUID casing cannot disguise duplicate organisations or engagement links", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const organisation = { ...input.organisations[0], id: id.toUpperCase() };
  assert.equal(
    parseReviewedMapping({ ...input, organisations: [organisation] })
      .organisations[0].id,
    id,
  );
  assert.throws(() =>
    parseReviewedMapping({
      ...input,
      organisations: [
        { ...organisation, engagementIds: [id, id.toUpperCase()] },
      ],
    }),
  );
});
