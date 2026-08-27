import assert from "node:assert/strict";
import test from "node:test";

import type { PreviewGenerationCandidate } from "../composition-repository";
import {
  createProspectPreviewPrRun,
  type ProspectPreviewPrGenerationRepository,
} from "./orchestrator";

const RUN_ID = "weekday-2026-08-27-0600-europe-london-v1";
const NOW = new Date("2026-08-27T05:05:00.000Z");
const candidates: readonly PreviewGenerationCandidate[] = [
  {
    previewId: "b7c63de7-3e17-4347-8f8a-618c1b0d09c8",
    prospectId: "3381388d-503a-4545-844d-6c29dedb2b35",
    snapshot: {
      schemaVersion: "1.0",
      businessName: "Marden Garage",
      sector: "Garage and MOT centre",
      locality: "Marden",
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
  },
  {
    previewId: "d5e63de7-3e17-4347-8f8a-618c1b0d09c8",
    prospectId: "e99a4971-7b37-4822-8119-ee239955aa21",
    snapshot: {
      schemaVersion: "1.0",
      businessName: "Fuggles Beer Cafe",
      sector: "Hospitality and beer cafe",
      locality: "Tunbridge Wells",
      businessGoal: "Make a first visit feel easy to plan.",
      primaryCta: "Plan your table enquiry",
      homepageSections: {
        schemaVersion: "1.0",
        summary: "Make the first visit easier to understand.",
        items: ["A considered welcome"],
      },
      conversionPlan: {
        schemaVersion: "1.0",
        summary: "Offer a simple enquiry route.",
        items: ["Ask for the first useful details"],
      },
      trustSignals: {
        schemaVersion: "1.0",
        summary: "Give guests a clear reason to visit.",
        items: ["Explain the local offer"],
      },
    },
  },
];

function createRepository(): {
  repository: ProspectPreviewPrGenerationRepository;
  unavailable: string[];
  opened: Array<{
    prospectId: string;
    slug: string;
    pullRequestNumber: number;
  }>;
} {
  const unavailable: string[] = [];
  const opened: Array<{
    prospectId: string;
    slug: string;
    pullRequestNumber: number;
  }> = [];

  return {
    unavailable,
    opened,
    repository: {
      async listGenerationCandidates(externalRunId) {
        assert.equal(externalRunId, RUN_ID);
        return candidates;
      },
      async markCompositionUnavailable(input) {
        unavailable.push(input.prospectId);
        return true;
      },
      async recordOpenPullRequest(input) {
        opened.push({
          prospectId: input.prospectId,
          slug: input.slug,
          pullRequestNumber: input.pullRequestNumber,
        });
        return true;
      },
    },
  };
}

test("creates one dated pull request and records every generated package", async () => {
  const state = createRepository();
  const githubCalls: Array<{ branch: string; filePaths: readonly string[] }> = [];

  const result = await createProspectPreviewPrRun({
    externalRunId: RUN_ID,
    now: () => NOW,
    repository: state.repository,
    github: {
      async createPullRequest(input) {
        githubCalls.push({
          branch: input.branch,
          filePaths: input.files.map((file) => file.path),
        });
        return {
          number: 412,
          url: "https://github.com/FSS-Ltd/fss-site/pull/412",
          alreadyOpen: false,
        };
      },
    },
  });

  assert.deepEqual(result, {
    externalRunId: RUN_ID,
    status: "created",
    generated: 2,
    unavailable: 0,
    pullRequestNumber: 412,
  });
  assert.deepEqual(githubCalls, [
    {
      branch: "generated/prospect-previews/2026-08-27",
      filePaths: [
        "lib/growth/prospect-previews/compositions/generated/fuggles-beer-cafe.ts",
        "lib/growth/prospect-previews/compositions/generated/marden-garage.ts",
        "lib/growth/prospect-previews/compositions/manifest.ts",
      ],
    },
  ]);
  assert.deepEqual(state.unavailable, []);
  assert.deepEqual(
    state.opened.map((entry) => entry.prospectId).sort(),
    candidates.map((candidate) => candidate.prospectId).sort(),
  );
});

test("does not create a pull request when every composition is unavailable", async () => {
  const unavailable: string[] = [];
  const repository: ProspectPreviewPrGenerationRepository = {
    async listGenerationCandidates() {
      return [
        {
          ...candidates[0]!,
          snapshot: { ...candidates[0]!.snapshot, sector: "Floristry" },
        },
      ];
    },
    async markCompositionUnavailable(input) {
      unavailable.push(input.prospectId);
      return true;
    },
    async recordOpenPullRequest() {
      throw new Error("A package must exist before it is recorded.");
    },
  };

  const result = await createProspectPreviewPrRun({
    externalRunId: RUN_ID,
    now: () => NOW,
    repository,
    github: {
      async createPullRequest() {
        throw new Error("GitHub must not be called for unavailable packages.");
      },
    },
  });

  assert.deepEqual(result, {
    externalRunId: RUN_ID,
    status: "unavailable",
    generated: 0,
    unavailable: 1,
    pullRequestNumber: null,
  });
  assert.deepEqual(unavailable, [candidates[0]!.prospectId]);
});

test("reports an existing dated pull request without changing publication state", async () => {
  const state = createRepository();

  const result = await createProspectPreviewPrRun({
    externalRunId: RUN_ID,
    now: () => NOW,
    repository: state.repository,
    github: {
      async createPullRequest() {
        return {
          number: 412,
          url: "https://github.com/FSS-Ltd/fss-site/pull/412",
          alreadyOpen: true,
        };
      },
    },
  });

  assert.equal(result.status, "existing");
  assert.equal(result.pullRequestNumber, 412);
  assert.equal(state.opened.length, 2);
});
