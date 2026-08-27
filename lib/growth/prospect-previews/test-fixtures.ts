import type { StoredProspectPreviewSnapshot } from "./types";

const SERVICE_EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";
const COLOUR_EVIDENCE_ID = "00000000-0000-4000-8000-000000000002";

export function withEvidenceBackedExperience(
  snapshot: StoredProspectPreviewSnapshot,
): StoredProspectPreviewSnapshot {
  if (snapshot.schemaVersion === "1.1") return snapshot;

  return {
    ...snapshot,
    schemaVersion: "1.1",
    experienceBrief: {
      schemaVersion: "1.1",
      hero: {
        statement: `Start your request with the information ${snapshot.businessName} needs.`,
        supportingStatement: snapshot.businessGoal,
        evidenceIds: [SERVICE_EVIDENCE_ID],
      },
      journey: {
        title: "A clearer first step",
        primaryCta: snapshot.primaryCta,
        completionMessage: "Your private preview request is ready to review.",
        steps: [
          {
            id: "service",
            label: "What do you need help with?",
            kind: "service-selection",
            control: "single-select",
            requiredFields: ["service"],
            options: ["Tell us what you need"],
          },
          {
            id: "review",
            label: "Review your request",
            kind: "review",
            control: "review",
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
}
