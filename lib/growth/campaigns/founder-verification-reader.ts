import { createHash } from "node:crypto";
import { z } from "zod";
import { loadConfiguredAccountReadiness } from "./account-repository";
import { validateCampaignDefinition } from "./lifecycle";
import { campaignPolicyDefinitionSchema } from "./schemas";
import type { FounderSession } from "../auth/require-founder";
import { CrmError } from "../crm/errors";
import type { GrowthQueryExecutor, GrowthTransaction } from "../db/types";

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
  return readFounderVerification(db, prospectId, now);
}

async function readFounderVerification(
  db: GrowthQueryExecutor,
  prospectId: string,
  now: Date,
): Promise<FounderVerificationSnapshot | null> {
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

// Caller holds the canonical membership, sequence and message locks.
export async function loadPolicyAuthorizedSourceProof(
  db: GrowthTransaction,
  input: {
    membershipId: string;
    messageId: string;
    connectionId: string;
  },
): Promise<Pick<
  FounderVerificationSnapshot,
  | "contactId"
  | "requestId"
  | "contactProofId"
  | "observationProofId"
  | "proofContactVersion"
  | "proofProspectVersion"
  | "freshUntil"
> | null> {
  const [clock] = await db<{ now: Date }[]>`select clock_timestamp() as now`;
  if (
    !clock ||
    (await loadConfiguredAccountReadiness(db, input.connectionId, "active"))
      .status !== "ready"
  )
    return null;
  const now = clock.now;
  const [authority] = await db<
    {
      prospectId: string;
      contactId: string;
      proofRequestId: string;
      prospectVersion: number;
      contactVersion: number;
      policy: unknown;
      policyVersion: number;
      basis: string;
      jurisdiction: string;
      evidence: unknown;
      country: string;
    }[]
  >`
    select c.policy,c.version as "policyVersion",p.basis,p.jurisdiction,p.evidence,b.country_code as country, m.prospect_id as "prospectId", p.contact_id as "contactId",
      p.proof_request_id as "proofRequestId", p.prospect_version as "prospectVersion",
      p.contact_version as "contactVersion"
    from growth.campaign_memberships m
    join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    join growth.outreach_permissions p on p.id=m.current_permission_id and p.membership_id=m.id
    join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=m.prospect_id
    join growth.prospects prospect on prospect.id=m.prospect_id
    join growth.businesses b on b.id=prospect.business_id
    join growth.email_messages em on em.sequence_enrollment_id=se.id and em.id=${input.messageId} and em.contact_id=se.contact_id
    where m.id=${input.membershipId} and m.status='active' and se.status='active'
      and c.status='approved' and c.approved_by is not null and c.approved_at is not null and c.approved_at <= ${now}
      and c.account_connection_id=${input.connectionId} and p.provider='gmail' and p.contact_id=se.contact_id
      and p.expires_at > ${now} and p.proof_request_id is not null
      and c.version=(select max(version) from growth.campaigns where id=c.id)
  `;
  if (!authority) return null;
  const policy = campaignPolicyDefinitionSchema.safeParse(authority.policy);
  const evidence = z
    .object({
      observedAt: z.iso.datetime(),
      explicitOptIn: z.boolean(),
      summary: z.string().trim().min(1),
      reference: z.object({
        kind: z.enum(["private", "public"]),
        value: z.string().trim().min(1),
      }),
    })
    .safeParse(authority.evidence);
  if (
    !policy.success ||
    !evidence.success ||
    authority.basis !== policy.data.permissionRequirement ||
    authority.jurisdiction !== policy.data.jurisdiction ||
    authority.jurisdiction !== authority.country ||
    (authority.basis === "consent" && !evidence.data.explicitOptIn) ||
    new Date(evidence.data.observedAt) > now
  )
    return null;
  try {
    validateCampaignDefinition(policy.data, authority.policyVersion, now, true);
  } catch {
    return null;
  }
  const proof = await readFounderVerification(db, authority.prospectId, now);
  if (
    !proof ||
    proof.status !== "current" ||
    proof.contactId !== authority.contactId ||
    proof.requestId !== authority.proofRequestId ||
    proof.proofContactVersion !== authority.contactVersion ||
    proof.proofProspectVersion !== authority.prospectVersion
  )
    return null;
  return {
    contactId: proof.contactId,
    requestId: proof.requestId,
    contactProofId: proof.contactProofId,
    observationProofId: proof.observationProofId,
    proofContactVersion: proof.proofContactVersion,
    proofProspectVersion: proof.proofProspectVersion,
    freshUntil: proof.freshUntil,
  };
}
