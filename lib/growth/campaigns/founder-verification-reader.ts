import { createHash } from "node:crypto";
import type { FounderSession } from "../auth/require-founder";
import { CrmError } from "../crm/errors";
import type { GrowthQueryExecutor } from "../db/types";

export type FounderVerificationSnapshot = {
  status: "current" | "stale";
  contactId: string;
  requestId: string;
  contactProofId: string;
  observationProofId: string;
  proofContactVersion: number;
  proofProspectVersion: number;
  email: string;
  observation: string;
  observationSourceUrl: string;
  observedAt: Date;
  contactSourceUrl: string;
  contactObservedAt: Date;
  verifiedAt: Date;
  effectiveEvidenceAt: Date;
  freshUntil: Date;
};

export async function loadFounderVerification(
  db: GrowthQueryExecutor,
  prospectId: string,
  now: Date,
  founder: FounderSession,
): Promise<FounderVerificationSnapshot | null> {
  if (
    founder.email !== "j.ntagengwa@faithfulsoftware.dev" ||
    founder.actorId !== createHash("sha256").update(founder.email).digest("hex")
  )
    throw new CrmError("invalid");
  const rows = await db<
    {
      contactId: string;
      proofId: string;
      email: string;
      claimType: string;
      summary: string;
      sourceUrl: string;
      observedAt: Date;
      verifiedAt: Date;
      proofContactVersion: number;
      proofProspectVersion: number;
      contactVersion: number;
      prospectVersion: number;
      primaryContactId: string | null;
      requestId: string;
    }[]
  >`
    with latest as (
      select request_id, prospect_version
      from growth.source_evidence
      where origin='founder' and prospect_id=${prospectId}
      group by request_id, prospect_version, contact_id, contact_version
      having count(distinct claim_type)=2
      order by prospect_version desc, request_id desc limit 1
    )
    select e.contact_id as "contactId", e.id as "proofId", c.email, e.claim_type as "claimType", e.claim_summary as summary, e.source_url as "sourceUrl", e.observed_at as "observedAt", e.verified_at as "verifiedAt", e.contact_version as "proofContactVersion", e.prospect_version as "proofProspectVersion", c.version as "contactVersion", p.version as "prospectVersion", p.primary_contact_id as "primaryContactId", e.request_id as "requestId"
    from growth.source_evidence e join growth.prospects p on p.id=e.prospect_id join growth.contacts c on c.id=e.contact_id
    join latest on latest.request_id=e.request_id and latest.prospect_version=e.prospect_version
    where e.origin='founder' and e.prospect_id=${prospectId}`;
  const contact = rows.find((row) => row.claimType === "contact_email");
  const observation = rows.find(
    (row) => row.claimType === "business_observation",
  );
  if (!contact || !observation || contact.requestId !== observation.requestId)
    return null;
  const fresh = (date: Date) => {
    const age = now.getTime() - date.getTime();
    return age >= 0 && age <= 30 * 86400000;
  };
  const current = rows.every(
    (row) =>
      row.primaryContactId === row.contactId &&
      row.contactVersion === row.proofContactVersion &&
      row.prospectVersion === row.proofProspectVersion &&
      fresh(row.observedAt) &&
      fresh(row.verifiedAt),
  );
  const effectiveEvidenceAt = new Date(
    Math.min(
      contact.observedAt.getTime(),
      observation.observedAt.getTime(),
      contact.verifiedAt.getTime(),
      observation.verifiedAt.getTime(),
    ),
  );
  return {
    effectiveEvidenceAt,
    freshUntil: new Date(effectiveEvidenceAt.getTime() + 30 * 86400000),
    status: current ? "current" : "stale",
    requestId: contact.requestId,
    contactProofId: contact.proofId,
    observationProofId: observation.proofId,
    proofContactVersion: contact.proofContactVersion,
    proofProspectVersion: contact.proofProspectVersion,
    contactId: contact.contactId,
    email: contact.email,
    observation: observation.summary,
    observationSourceUrl: observation.sourceUrl,
    observedAt: observation.observedAt,
    contactSourceUrl: contact.sourceUrl,
    contactObservedAt: contact.observedAt,
    verifiedAt: contact.verifiedAt,
  };
}
