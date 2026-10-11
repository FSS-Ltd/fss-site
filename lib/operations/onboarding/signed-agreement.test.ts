import assert from "node:assert/strict";
import test from "node:test";
import { signedAgreementEvidence } from "./signed-agreement";

const evidence = {
  id: "bc4a083f-33e0-429a-aeb4-aeb3a1f7a866",
  revision: 2,
  provenance: "manual_founder_confirmation" as const,
};

test("a welcome can start only with current signed evidence on an unarchived agreement", () => {
  const agreement = { status: "signed", archivedAt: null, revision: 2 };
  assert.deepEqual(signedAgreementEvidence(agreement, evidence), evidence);
  for (const changed of [
    { status: "draft" },
    { status: "withdrawn" },
    { archivedAt: "2026-10-11T12:00:00Z" },
    { revision: 3 },
  ]) {
    assert.equal(
      signedAgreementEvidence({ ...agreement, ...changed }, evidence),
      null,
    );
  }
  assert.equal(signedAgreementEvidence(agreement, null), null);
  assert.deepEqual(
    signedAgreementEvidence(agreement, {
      ...evidence,
      provenance: "authenticated_portal_electronic_signature",
    }),
    { ...evidence, provenance: "authenticated_portal_electronic_signature" },
  );
});
