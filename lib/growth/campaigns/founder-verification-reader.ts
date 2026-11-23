import { createHash } from "node:crypto";
import { validPermissionEvidence } from "./permission-evidence";
import {
  readReviewPreparationCandidate,
  type PreparationSource,
} from "./review-preparation-query";
import { loadReservationAccount } from "./account-repository";
import { loadResendAccountReadiness } from "./resend-account-repository";
import type { ResendRuntimeConfiguration } from "./resend-account-control";
import { isPublicHttpUrl } from "../http/public-url";
import {
  businessWebsiteHost,
  hasRelatedWorkEmail,
} from "../research/global-identity";
import {
  intersectAuthorityBounds,
  type AuthorityBounds,
} from "./authority-bounds";
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
  return (await readFounderVerification(db, prospectId, now))?.snapshot ?? null;
}

async function readFounderVerification(
  db: GrowthQueryExecutor,
  prospectId: string,
  now: Date,
): Promise<{
  snapshot: FounderVerificationSnapshot;
  validThrough: Date;
} | null> {
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
    validThrough: new Date(
      Math.min(
        ...rows.flatMap((row) => [
          row.observedAt.getTime(),
          row.verifiedAt.getTime(),
        ]),
      ) +
        30 * 86400000,
    ),
    snapshot: {
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
    },
  };
}

type SourceProofFields = Pick<
  FounderVerificationSnapshot,
  | "contactId"
  | "contactProofId"
  | "observationProofId"
  | "proofContactVersion"
  | "proofProspectVersion"
  | "freshUntil"
>;
export type SourceProof = SourceProofFields &
  (
    | { origin: "founder"; requestId: string }
    | { origin: "research"; bindingId: string }
  );
type ProofReference =
  | { origin: "founder"; requestId: string }
  | { origin: "research"; bindingId: string };

async function readSourceProof(
  db: GrowthQueryExecutor,
  prospectId: string,
  now: Date,
  reference: ProofReference,
): Promise<{ proof: SourceProof; validThrough: Date } | null> {
  if (reference.origin === "founder") {
    const result = await readFounderVerification(db, prospectId, now);
    const snapshot = result?.snapshot;
    if (
      !result ||
      !snapshot ||
      snapshot.status !== "current" ||
      snapshot.requestId !== reference.requestId
    )
      return null;
    return {
      validThrough: result.validThrough,
      proof: {
        origin: "founder",
        requestId: snapshot.requestId,
        contactId: snapshot.contactId,
        contactProofId: snapshot.contactProofId,
        observationProofId: snapshot.observationProofId,
        proofContactVersion: snapshot.proofContactVersion,
        proofProspectVersion: snapshot.proofProspectVersion,
        freshUntil: snapshot.freshUntil,
      },
    };
  }
  const [row] = await db<
    {
      contactId: string;
      verifiedEmail: string;
      currentEmail: string;
      contactProofId: string;
      observationProofId: string;
      proofContactVersion: number;
      proofProspectVersion: number;
      contactVersion: number;
      prospectVersion: number;
      primaryContactId: string | null;
      businessSourceUrl: string;
      websiteUrl: string | null;
      currentEmailSourceUrl: string;
      contactSourceUrl: string;
      observationSourceUrl: string;
      businessVerifiedAt: Date;
      emailVerifiedAt: Date;
      contactObservedAt: Date;
      contactVerifiedAt: Date;
      observationObservedAt: Date;
      observationVerifiedAt: Date;
    }[]
  >`
    select b.contact_id as "contactId",b.verified_email as "verifiedEmail",c.normalised_email as "currentEmail",b.contact_evidence_id as "contactProofId",b.observation_evidence_id as "observationProofId",b.contact_version as "proofContactVersion",b.prospect_version as "proofProspectVersion",c.version as "contactVersion",p.version as "prospectVersion",p.primary_contact_id as "primaryContactId",business.first_party_source_url as "businessSourceUrl",business.website_url as "websiteUrl",c.email_source_url as "currentEmailSourceUrl",ce.source_url as "contactSourceUrl",oe.source_url as "observationSourceUrl",business.verified_at as "businessVerifiedAt",c.email_verified_at as "emailVerifiedAt",ce.observed_at as "contactObservedAt",ce.verified_at as "contactVerifiedAt",oe.observed_at as "observationObservedAt",oe.verified_at as "observationVerifiedAt"
    from growth.research_source_proof_bindings b join growth.research_runs r on r.id=b.research_run_id and r.status='completed' and r.verified_key_id is not null and r.signed_body_sha256 is not null join growth.prospects p on p.id=b.prospect_id join growth.businesses business on business.id=b.business_id join growth.contacts c on c.id=b.contact_id join growth.source_evidence ce on ce.id=b.contact_evidence_id join growth.source_evidence oe on oe.id=b.observation_evidence_id
    where b.id=${reference.bindingId} and b.prospect_id=${prospectId}`;
  if (
    !row ||
    row.primaryContactId !== row.contactId ||
    row.contactVersion !== row.proofContactVersion ||
    row.prospectVersion !== row.proofProspectVersion
  )
    return null;
  const businessHost = isPublicHttpUrl(row.businessSourceUrl)
    ? businessWebsiteHost(row.businessSourceUrl)
    : null;
  if (
    !businessHost ||
    row.verifiedEmail !== row.currentEmail ||
    !hasRelatedWorkEmail(row.businessSourceUrl, row.currentEmail) ||
    row.contactSourceUrl !== row.currentEmailSourceUrl ||
    !isPublicHttpUrl(row.contactSourceUrl) ||
    !isPublicHttpUrl(row.observationSourceUrl) ||
    businessWebsiteHost(row.contactSourceUrl) !== businessHost ||
    businessWebsiteHost(row.observationSourceUrl) !== businessHost ||
    (row.websiteUrl !== null &&
      (!isPublicHttpUrl(row.websiteUrl) ||
        businessWebsiteHost(row.websiteUrl) !== businessHost))
  )
    return null;
  const dates = [
    row.businessVerifiedAt,
    row.emailVerifiedAt,
    row.contactObservedAt,
    row.contactVerifiedAt,
    row.observationObservedAt,
    row.observationVerifiedAt,
  ].map((value) => value.getTime());
  if (
    dates.some(
      (value) =>
        !Number.isFinite(value) ||
        value > now.getTime() ||
        now.getTime() - value > 30 * 86400000,
    )
  )
    return null;
  const validThrough = new Date(Math.min(...dates) + 30 * 86400000);
  return {
    validThrough,
    proof: {
      origin: "research",
      bindingId: reference.bindingId,
      contactId: row.contactId,
      contactProofId: row.contactProofId,
      observationProofId: row.observationProofId,
      proofContactVersion: row.proofContactVersion,
      proofProspectVersion: row.proofProspectVersion,
      freshUntil: validThrough,
    },
  };
}

export async function loadFounderSourceProof(
  db: GrowthQueryExecutor,
  prospectId: string,
  now: Date,
  founder: FounderSession,
  reference: ProofReference,
): Promise<SourceProof | null> {
  if (
    founder.email !== "j.ntagengwa@faithfulsoftware.dev" ||
    founder.actorId !== createHash("sha256").update(founder.email).digest("hex")
  )
    throw new CrmError("invalid");
  return (await readSourceProof(db, prospectId, now, reference))?.proof ?? null;
}

type AuthorityRow = {
  prospectId: string;
  contactId: string;
  prospectVersion: number;
  contactVersion: number;
  proofOrigin: "founder" | "research" | null;
  proofRequestId: string | null;
  researchProofId: string | null;
  policy: unknown;
  policyVersion: number;
  basis: string;
  provider: string;
  jurisdiction: string;
  country: string;
  evidence: unknown;
};
async function validateAuthorityProof(
  db: GrowthTransaction,
  authority: AuthorityRow,
  now: Date,
) {
  const parsed = campaignPolicyDefinitionSchema.safeParse(authority.policy);
  if (
    !parsed.success ||
    authority.provider !== parsed.data.provider ||
    authority.basis !== parsed.data.permissionRequirement ||
    authority.jurisdiction !== parsed.data.jurisdiction ||
    authority.jurisdiction !== authority.country ||
    !validPermissionEvidence({
      basis: authority.basis,
      provider: authority.provider,
      jurisdiction: authority.jurisdiction,
      offer: parsed.data.offer,
      now,
      evidence: authority.evidence,
    })
  )
    return null;
  try {
    validateCampaignDefinition(parsed.data, authority.policyVersion, now, true);
  } catch {
    return null;
  }
  const reference: ProofReference | null =
    authority.proofOrigin === "founder" && authority.proofRequestId
      ? { origin: "founder", requestId: authority.proofRequestId }
      : authority.proofOrigin === "research" && authority.researchProofId
        ? { origin: "research", bindingId: authority.researchProofId }
        : null;
  if (!reference) return null;
  const result = await readSourceProof(
    db,
    authority.prospectId,
    now,
    reference,
  );
  if (
    !result ||
    result.proof.contactId !== authority.contactId ||
    result.proof.proofContactVersion !== authority.contactVersion ||
    result.proof.proofProspectVersion !== authority.prospectVersion
  )
    return null;
  return { result, policy: parsed.data };
}

// Caller holds connection, control, usage, membership, sequence and message locks.
export async function loadPolicyAuthorizedSourceProof(
  db: GrowthTransaction,
  input: {
    membershipId: string;
    messageId: string;
    connectionId: string;
    resendRuntime?: ResendRuntimeConfiguration;
  },
): Promise<{
  proof: SourceProof;
  bounds: AuthorityBounds;
} | null> {
  const [clock] = await db<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!clock) return null;
  const provider = input.resendRuntime ? "resend" : "gmail";
  const account = input.resendRuntime
    ? await loadResendAccountReadiness(
        db,
        input.connectionId,
        input.resendRuntime,
      )
    : await loadReservationAccount(db, input.connectionId, "held");
  if (account.status !== "ready") return null;
  const accountBounds: AuthorityBounds =
    "account" in account
      ? account.account.bounds
      : {
          validatedAt: clock.now,
          expiresAt: account.expiresAt,
          validThrough: null,
        };
  const now = clock.now;
  const [authority] = await db<
    {
      prospectId: string;
      contactId: string;
      proofOrigin: "founder" | "research" | null;
      proofRequestId: string | null;
      researchProofId: string | null;
      prospectVersion: number;
      contactVersion: number;
      policy: unknown;
      policyVersion: number;
      basis: string;
      provider: string;
      jurisdiction: string;
      evidence: unknown;
      country: string;
    }[]
  >`
    select c.policy,c.version as "policyVersion",p.basis,p.provider,p.jurisdiction,p.evidence,b.country_code as country, m.prospect_id as "prospectId", p.contact_id as "contactId",
      p.proof_origin as "proofOrigin", p.proof_request_id as "proofRequestId", p.research_proof_id as "researchProofId", p.prospect_version as "prospectVersion",
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
      and c.account_connection_id=${input.connectionId} and p.provider=${provider} and em.channel=${provider} and c.policy->>'provider'=p.provider and p.contact_id=se.contact_id and p.actor_id=${createHash("sha256").update("j.ntagengwa@faithfulsoftware.dev").digest("hex")}
      and p.expires_at > ${now} and p.proof_origin in ('founder','research')
      and c.version=(select max(version) from growth.campaigns where id=c.id)
  `;
  if (!authority) return null;
  const validated = await validateAuthorityProof(db, authority, now);
  if (!validated) return null;
  const { result } = validated;
  const proof = result.proof;
  return {
    bounds: intersectAuthorityBounds(accountBounds, {
      validatedAt: now,
      expiresAt: accountBounds.expiresAt,
      validThrough: result.validThrough,
    }),
    proof,
  };
}

// Caller holds the account, campaign, membership, prospect and contact locks.
export async function loadReviewMembershipPreparationAuthority(
  db: GrowthTransaction,
  input: {
    membershipId: string;
    connectionId: string;
    source: PreparationSource;
    resendRuntime?: ResendRuntimeConfiguration;
  },
): Promise<{
  proof: SourceProof;
  policyApproverId: string;
  bounds: AuthorityBounds;
} | null> {
  const [clock] = await db<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!clock) return null;
  const provider = input.resendRuntime ? "resend" : "gmail";
  const account = input.resendRuntime
    ? await loadResendAccountReadiness(
        db,
        input.connectionId,
        input.resendRuntime,
      )
    : await loadReservationAccount(db, input.connectionId, "held");
  if (account.status !== "ready") return null;
  const accountBounds: AuthorityBounds =
    "account" in account
      ? account.account.bounds
      : {
          validatedAt: clock.now,
          expiresAt: account.expiresAt,
          validThrough: null,
        };
  const now = clock.now;
  const row = await readReviewPreparationCandidate(
    db,
    { ...input, provider },
    now,
  );
  if (!row) return null;
  const validated = await validateAuthorityProof(db, row, now);
  if (!validated || !validated.policy.expiresAt) return null;
  const { result, policy } = validated;
  const policyExpiresAt = policy.expiresAt;
  if (!policyExpiresAt) return null;
  return {
    proof: result.proof,
    policyApproverId: row.approvedBy,
    bounds: intersectAuthorityBounds(accountBounds, {
      validatedAt: now,
      expiresAt: new Date(
        Math.min(
          row.permissionExpiresAt.getTime(),
          policyExpiresAt.getTime(),
          policy.capabilityAttestation.expiresAt.getTime(),
          policy.providerAttestation.expiresAt.getTime(),
        ),
      ),
      validThrough: result.validThrough,
    }),
  };
}
