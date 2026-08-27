import assert from "node:assert/strict";
import test from "node:test";

import type { StoredProspectPreviewSnapshot } from "../types";
import {
  PreviewRefreshError,
  refreshEvidenceBackedPreview,
  type ProspectPreviewRefreshRepository,
} from "./service";

const PROSPECT_ID = "6322f2e9-a320-4e3c-8fbf-b2f137949e2c";
const SERVICE_EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";
const COLOUR_EVIDENCE_ID = "00000000-0000-4000-8000-000000000002";

const snapshot: StoredProspectPreviewSnapshot = {
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
};

const update = {
  prospectId: PROSPECT_ID,
  brandEvidence: [
    {
      id: SERVICE_EVIDENCE_ID,
      kind: "service-language" as const,
      sourceUrl: "https://marden.example.test/mot",
      evidenceText: "MOT, servicing and repairs for local drivers.",
      observedAt: "2026-08-27T06:00:00.000Z",
    },
    {
      id: COLOUR_EVIDENCE_ID,
      kind: "brand-colours" as const,
      sourceUrl: "https://marden.example.test",
      evidenceText: "Deep blue brand colour used in the site header.",
      observedAt: "2026-08-27T06:00:00.000Z",
    },
  ],
  experienceBrief: {
    schemaVersion: "1.1" as const,
    hero: {
      statement: "MOT, servicing and repairs with a clearer first step.",
      supportingStatement: "Prepare the right vehicle request before workshop follow-up.",
      evidenceIds: [SERVICE_EVIDENCE_ID],
    },
    journey: {
      title: "Prepare your vehicle request",
      primaryCta: "Continue with vehicle details",
      completionMessage: "This demonstration does not send or store your request.",
      steps: [
        {
          id: "registration",
          label: "Vehicle registration",
          kind: "vehicle-registration" as const,
          control: "registration" as const,
          requiredFields: ["registration" as const],
          options: [],
        },
        {
          id: "review",
          label: "Review your request",
          kind: "review" as const,
          control: "review" as const,
          requiredFields: [],
          options: [],
        },
      ],
    },
    visual: {
      brandColors: ["#19374A"],
      colourEvidenceIds: [COLOUR_EVIDENCE_ID],
      logoEvidenceId: null,
      logoAssetId: null,
      onSiteImageEvidenceId: null,
      onSiteImageAssetId: null,
      approvedHeroMediaAssetId: null,
    },
  },
};

function createRepository(
  state: "draft" | "published" = "draft",
): {
  repository: ProspectPreviewRefreshRepository;
  updated: StoredProspectPreviewSnapshot | null;
  writes: number;
} {
  let updated: StoredProspectPreviewSnapshot | null = null;
  let writes = 0;
  return {
    repository: {
      withTransaction: async (operation) =>
        operation({
          loadPreview: async (prospectId) =>
            prospectId === PROSPECT_ID
              ? {
                  status: state,
                  generationStatus:
                    state === "draft" ? "merged_draft" : "published",
                  firstPartySourceUrl: "https://marden.example.test",
                  snapshot,
                }
              : null,
          replaceDraftPreview: async (input) => {
            updated = input.snapshot;
            writes += 1;
            return true;
          },
        }),
    },
    get updated() {
      return updated;
    },
    get writes() {
      return writes;
    },
  };
}

test("refreshes only an existing draft for source regeneration", async () => {
  const state = createRepository();

  const result = await refreshEvidenceBackedPreview(update, state.repository);

  assert.deepEqual(result, { prospectId: PROSPECT_ID, status: "refreshed" });
  assert.equal(state.updated?.schemaVersion, "1.1");
  assert.equal(state.updated?.experienceBrief.journey.steps[0]?.kind, "vehicle-registration");
  assert.equal(state.writes, 1);
});

test("rejects a published preview before changing its content", async () => {
  const state = createRepository("published");

  await assert.rejects(
    () => refreshEvidenceBackedPreview(update, state.repository),
    (error: unknown) => {
      assert.ok(error instanceof PreviewRefreshError);
      assert.equal(error.code, "preview_not_refreshable");
      return true;
    },
  );
  assert.equal(state.writes, 0);
});

test("rejects visual evidence from a host outside the prospect first-party site", async () => {
  const state = createRepository();
  const invalid = {
    ...update,
    brandEvidence: [
      ...update.brandEvidence.slice(0, 1),
      {
        ...update.brandEvidence[1],
        sourceUrl: "https://maps.google.com/place/marden",
      },
    ],
  };

  await assert.rejects(
    () => refreshEvidenceBackedPreview(invalid, state.repository),
    (error: unknown) => {
      assert.ok(error instanceof PreviewRefreshError);
      assert.equal(error.code, "invalid_first_party_evidence");
      return true;
    },
  );
  assert.equal(state.writes, 0);
});
