import assert from "node:assert/strict";
import test from "node:test";

import type { PreviewGenerationCandidate } from "../composition-repository";
import {
  runCurrentTenPreviewBackfill,
  type CurrentTenPreviewBackfillRepository,
} from "./current-ten-backfill";

const RUN_ID = "current-ten-2026-08-27";
const NOW = new Date("2026-08-27T06:10:00.000Z");

function candidate(index: number): PreviewGenerationCandidate {
  const identifier = `${index}`.padStart(8, "0");
  const sectors = [
    "Garage and MOT centre",
    "Garage and MOT centre",
    "Roofing and property repairs",
    "Roofing and property repairs",
    "Hospitality and beer cafe",
    "Hospitality and beer cafe",
    "Estate agency and lettings",
    "Estate agency and lettings",
    "Accountancy services",
    "Accountancy services",
  ];
  const sector = sectors[index - 1];
  if (!sector) throw new Error("Fixture sector is missing.");
  return {
    previewId: `${identifier}-0000-4000-8000-000000000001`,
    prospectId: `${identifier}-0000-4000-8000-000000000002`,
    snapshot: {
      schemaVersion: "1.0",
      businessName: `Prospect ${index}`,
      sector,
      locality: "Kent",
      businessGoal: "Help drivers book the right vehicle care without uncertainty.",
      primaryCta: "Request an MOT slot",
      homepageSections: {
        schemaVersion: "1.0",
        summary: "Make MOT and servicing routes clear.",
        items: ["MOT booking"],
      },
      conversionPlan: {
        schemaVersion: "1.0",
        summary: "Offer one clear route into the workshop.",
        items: ["Show the next available MOT step"],
      },
      trustSignals: {
        schemaVersion: "1.0",
        summary: "Local drivers need clear evidence before booking.",
        items: ["Explain workshop experience"],
      },
    },
  };
}

function createRepository(
  candidates: readonly PreviewGenerationCandidate[],
): CurrentTenPreviewBackfillRepository {
  return {
    async listEligibleExistingCandidates() {
      return candidates;
    },
    async markCompositionUnavailable() {
      return true;
    },
    async recordOpenPullRequest() {
      return true;
    },
  };
}

test("creates exactly ten source-only preview packages without approval or email collaborators", async () => {
  const candidates = Array.from({ length: 10 }, (_, index) =>
    candidate(index + 1),
  );
  const githubCalls: number[] = [];

  const result = await runCurrentTenPreviewBackfill({
    externalRunId: RUN_ID,
    now: () => NOW,
    repository: createRepository(candidates),
    github: {
      async createPullRequest() {
        githubCalls.push(1);
        return {
          number: 413,
          url: "https://github.com/FSS-Ltd/fss-site/pull/413",
          alreadyOpen: false,
        };
      },
    },
  });

  assert.deepEqual(result, {
    externalRunId: RUN_ID,
    status: "created",
    generated: 10,
    unavailable: 0,
    pullRequestNumber: 413,
  });
  assert.equal(githubCalls.length, 1);
});

test("fails before GitHub when the historical selection is not exactly ten", async () => {
  let githubCalls = 0;
  await assert.rejects(
    runCurrentTenPreviewBackfill({
      externalRunId: RUN_ID,
      now: () => NOW,
      repository: createRepository([candidate(1)]),
      github: {
        async createPullRequest() {
          githubCalls += 1;
          return {
            number: 413,
            url: "https://github.com/FSS-Ltd/fss-site/pull/413",
            alreadyOpen: false,
          };
        },
      },
    }),
    /exactly ten/i,
  );
  assert.equal(githubCalls, 0);
});

test("rejects an arbitrary historical backfill identifier", async () => {
  await assert.rejects(
    runCurrentTenPreviewBackfill({
      externalRunId: "current-ten-invalid",
      now: () => NOW,
      repository: createRepository(Array.from({ length: 10 }, (_, index) => candidate(index + 1))),
      github: { async createPullRequest() { throw new Error("unreachable"); } },
    }),
    /run ID/i,
  );
});
