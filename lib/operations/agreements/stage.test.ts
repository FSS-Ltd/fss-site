import assert from "node:assert/strict";
import test from "node:test";
import { agreementStage, stagePresentation } from "./stage";

const offer = {
  status: "published" as const,
  spec: {
    cash: { mode: "client_proposed" as const },
    revenueShare: null,
  },
};
const signing = {
  status: "approved" as const,
  completionFailureCode: null,
  requiredSigners: ["client@example.test", "founder@example.test"],
  signatures: [
    {
      email: "client@example.test",
      typedName: "Client",
      userId: "test",
      signedAt: "2026-10-10T12:00:00.000Z",
    },
  ],
};

test("commercial and signing stages distinguish proposal, signature and retained evidence", () => {
  assert.equal(agreementStage({}), "draft");
  assert.equal(agreementStage({ offer }), "budget_requested");
  assert.equal(
    agreementStage({ offer: { ...offer, status: "proposed" } }),
    "proposal_submitted",
  );
  assert.equal(agreementStage({ offer, signing }), "approved");
  assert.equal(
    agreementStage({
      signing: {
        ...signing,
        signatures: [
          ...signing.signatures,
          { ...signing.signatures[0], email: "founder@example.test" },
        ],
      },
    }),
    "signatures_collected",
  );
  assert.equal(
    agreementStage({
      signing: {
        ...signing,
        status: "completed",
        signatures: [
          ...signing.signatures,
          { ...signing.signatures[0], email: "founder@example.test" },
        ],
      },
      completeEvidence: true,
    }),
    "completed",
  );
  assert.equal(
    stagePresentation("signatures_collected", "staff").label,
    "Preparing signed copy",
  );
  assert.equal(
    agreementStage({
      signing: {
        ...signing,
        completionFailureCode: "document_processing_failed",
      },
    }),
    "attention_required",
  );
});
