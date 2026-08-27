import assert from "node:assert/strict";
import test from "node:test";

import type { PreviewGenerationCandidate } from "../composition-repository";
import { withEvidenceBackedExperience } from "../test-fixtures";
import {
  isCurrentThirteenEvidenceRefreshRunId,
  runCurrentThirteenEvidenceRefresh,
  type CurrentThirteenEvidenceRefreshRepository,
} from "./current-thirteen-evidence-refresh";

const RUN_ID = "evidence-refresh-thirteen-2026-08-27";
const NOW = new Date("2026-08-27T19:00:00.000Z");

function candidate(index: number): PreviewGenerationCandidate {
  const identifier = `${index}`.padStart(8, "0");
  return {
    previewId: `${identifier}-0000-4000-8000-000000000001`,
    prospectId: `${identifier}-0000-4000-8000-000000000002`,
    snapshot: withEvidenceBackedExperience({
      schemaVersion: "1.0",
      businessName: `Prospect ${index}`,
      sector: "Estate agents",
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
    }),
  };
}

function createRepository(
  candidates: readonly PreviewGenerationCandidate[],
): CurrentThirteenEvidenceRefreshRepository {
  return {
    async listEligibleEvidenceCandidates() {
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

test("recognises only dated thirteen-draft evidence refresh identifiers", () => {
  assert.equal(isCurrentThirteenEvidenceRefreshRunId(RUN_ID), true);
  assert.equal(
    isCurrentThirteenEvidenceRefreshRunId("evidence-refresh-ten-2026-08-27"),
    false,
  );
});

test("creates replacement packages for all active evidence-backed drafts on a dedicated source branch", async () => {
  for (const candidateCount of [12, 13]) {
    const candidates = Array.from({ length: candidateCount }, (_, index) =>
      candidate(index + 1),
    );
    const calls: Array<{ branch: string; replaceExistingSlugs: boolean }> = [];

    const result = await runCurrentThirteenEvidenceRefresh({
      externalRunId: RUN_ID,
      now: () => NOW,
      repository: createRepository(candidates),
      github: {
        async createPullRequest(input) {
          calls.push({
            branch: input.branch,
            replaceExistingSlugs: input.replaceExistingSlugs,
          });
          return {
            number: 414,
            url: "https://github.com/FSS-Ltd/fss-site/pull/414",
            alreadyOpen: false,
          };
        },
      },
    });

    assert.deepEqual(result, {
      externalRunId: RUN_ID,
      status: "created",
      generated: candidateCount,
      unavailable: 0,
      pullRequestNumber: 414,
    });
    assert.deepEqual(calls, [
      {
        branch: "generated/prospect-previews/2026-08-27-evidence-refresh",
        replaceExistingSlugs: true,
      },
    ]);
  }
});

test("fails before GitHub when the active evidence refresh has no eligible drafts", async () => {
  let githubCalls = 0;
  await assert.rejects(
    runCurrentThirteenEvidenceRefresh({
      externalRunId: RUN_ID,
      now: () => NOW,
      repository: createRepository([]),
      github: {
        async createPullRequest() {
          githubCalls += 1;
          throw new Error("unreachable");
        },
      },
    }),
    /between one and thirteen/i,
  );
  assert.equal(githubCalls, 0);
});

test("fails before GitHub when the active evidence refresh exceeds its audited batch limit", async () => {
  let githubCalls = 0;
  const candidates = Array.from({ length: 14 }, (_, index) => candidate(index + 1));
  await assert.rejects(
    runCurrentThirteenEvidenceRefresh({
      externalRunId: RUN_ID,
      now: () => NOW,
      repository: createRepository(candidates),
      github: {
        async createPullRequest() {
          githubCalls += 1;
          throw new Error("unreachable");
        },
      },
    }),
    /between one and thirteen/i,
  );
  assert.equal(githubCalls, 0);
});
