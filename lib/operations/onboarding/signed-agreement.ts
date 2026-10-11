export type SignedEvidence = Readonly<{
  id: string;
  revision: number;
  provenance:
    | "manual_founder_confirmation"
    | "authenticated_portal_electronic_signature";
}>;

import type { OperationsTransaction } from "../db/client";

export async function loadCurrentSignedEvidence(
  tx: OperationsTransaction,
  organisationId: string,
  agreement: Readonly<{
    id: string;
    status: string;
    archivedAt: string | null;
    revision: number;
  }>,
): Promise<SignedEvidence | null> {
  if (agreement.status !== "signed" || agreement.archivedAt !== null)
    return null;
  const [evidence] = await tx<SignedEvidence[]>`
    select id, revision, provenance
    from operations.signature_evidence
    where organisation_id = ${organisationId}
      and agreement_id = ${agreement.id}
      and revision = ${agreement.revision}
  `;
  return signedAgreementEvidence(agreement, evidence ?? null);
}

export function signedAgreementEvidence(
  agreement: Readonly<{
    status: string;
    archivedAt: string | null;
    revision: number;
  }>,
  evidence: SignedEvidence | null,
): SignedEvidence | null {
  return agreement.status === "signed" &&
    agreement.archivedAt === null &&
    evidence?.revision === agreement.revision &&
    (evidence.provenance === "manual_founder_confirmation" ||
      evidence.provenance === "authenticated_portal_electronic_signature")
    ? evidence
    : null;
}
