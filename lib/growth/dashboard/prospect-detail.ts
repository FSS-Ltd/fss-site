import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { ProspectStatus } from "../db/repositories/prospects";
import type { GrowthQueryExecutor } from "../db/types";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_EVIDENCE_ITEMS = 50;
const MAX_AUDIT_ENTRIES = 10;

export type ProspectDetailBusiness = {
  legalName: string;
  tradingName: string | null;
  companyNumber: string | null;
  corporateType: string;
  corporateStatus: string;
  sector: string;
  locality: string;
  websiteUrl: string | null;
  googlePlaceId: string | null;
  googleMapsReferenceUrl: string | null;
  verifiedAt: string;
};

export type ProspectDetailContact = {
  firstName: string;
  lastName: string;
  roleTitle: string | null;
  email: string;
  emailSourceUrl: string;
  emailVerifiedAt: string;
  subscriberType: string;
  lawfulBasis: string;
};

export type ProspectDetailWebsiteAssessment = {
  businessGoal: string;
  primaryCta: string;
  status: string;
  reviewedAt: string | null;
};

export type ProspectDetailPreview = {
  status: string;
  version: number;
};

export type ProspectDetailVisualAsset = {
  blobUrl: string;
  altText: string;
  width: number;
  height: number;
  reviewStatus: string;
  createdAt: string;
};

export type ProspectDetailSequence = {
  id: string;
  status: string;
  currentStep: number;
  startedAt: string | null;
  stoppedAt: string | null;
  stopReason: string | null;
};

export type ProspectEvidenceItem = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  claimType: string;
  claimSummary: string;
  observedAt: string;
  verifiedAt: string;
};

export type ProspectAuditEntry = {
  action: string;
  actorType: string;
  createdAt: string;
};

export type ProspectDetail = {
  id: string;
  version: number;
  status: ProspectStatus;
  fitScore: number;
  opportunitySummary: string;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
  estimatedMonthlyPence: number;
  nextAction: string | null;
  nextActionDueAt: string | null;
  createdAt: string;
  business: ProspectDetailBusiness;
  contact: ProspectDetailContact | null;
  websiteAssessment: ProspectDetailWebsiteAssessment | null;
  preview: ProspectDetailPreview | null;
  visualAsset: ProspectDetailVisualAsset | null;
  sequence: ProspectDetailSequence | null;
  evidence: readonly ProspectEvidenceItem[];
  auditSummary: readonly ProspectAuditEntry[];
};

export type ProspectDetailResult =
  | { status: "found"; data: ProspectDetail }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

type CoreRow = {
  id: string;
  version: number;
  status: ProspectStatus;
  fitScore: number;
  opportunitySummary: string;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
  estimatedMonthlyPence: number;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  createdAt: Date;
  businessLegalName: string;
  businessTradingName: string | null;
  businessCompanyNumber: string | null;
  businessCorporateType: string;
  businessCorporateStatus: string;
  businessSector: string;
  businessLocality: string;
  businessWebsiteUrl: string | null;
  businessGooglePlaceId: string | null;
  businessGoogleMapsReferenceUrl: string | null;
  businessVerifiedAt: Date;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactRoleTitle: string | null;
  contactEmail: string | null;
  contactEmailSourceUrl: string | null;
  contactEmailVerifiedAt: Date | null;
  contactSubscriberType: string | null;
  contactLawfulBasis: string | null;
  websiteBusinessGoal: string | null;
  websitePrimaryCta: string | null;
  websiteStatus: string | null;
  websiteReviewedAt: Date | null;
  previewStatus: string | null;
  previewVersion: number | null;
  visualBlobUrl: string | null;
  visualAltText: string | null;
  visualWidth: number | null;
  visualHeight: number | null;
  visualReviewStatus: string | null;
  visualCreatedAt: Date | null;
  sequenceId: string | null;
  sequenceStatus: string | null;
  sequenceCurrentStep: number | null;
  sequenceStartedAt: Date | null;
  sequenceStoppedAt: Date | null;
  sequenceStopReason: string | null;
};

async function fetchCoreRow(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<CoreRow | null> {
  const rows = await db<CoreRow[]>`
    select
      p.id,
      p.version,
      p.status,
      p.fit_score as "fitScore",
      p.opportunity_summary as "opportunitySummary",
      p.recommended_offer as "recommendedOffer",
      p.estimated_one_off_min_pence as "estimatedOneOffMinPence",
      p.estimated_one_off_max_pence as "estimatedOneOffMaxPence",
      p.estimated_monthly_pence as "estimatedMonthlyPence",
      p.next_action as "nextAction",
      p.next_action_due_at as "nextActionDueAt",
      p.created_at as "createdAt",
      b.legal_name as "businessLegalName",
      b.trading_name as "businessTradingName",
      b.company_number as "businessCompanyNumber",
      b.corporate_type as "businessCorporateType",
      b.corporate_status as "businessCorporateStatus",
      b.sector as "businessSector",
      b.locality as "businessLocality",
      b.website_url as "businessWebsiteUrl",
      b.google_place_id as "businessGooglePlaceId",
      b.google_maps_reference_url as "businessGoogleMapsReferenceUrl",
      b.verified_at as "businessVerifiedAt",
      c.first_name as "contactFirstName",
      c.last_name as "contactLastName",
      c.role_title as "contactRoleTitle",
      c.email as "contactEmail",
      c.email_source_url as "contactEmailSourceUrl",
      c.email_verified_at as "contactEmailVerifiedAt",
      c.subscriber_type as "contactSubscriberType",
      c.lawful_basis as "contactLawfulBasis",
      wa.business_goal as "websiteBusinessGoal",
      wa.primary_cta as "websitePrimaryCta",
      wa.status as "websiteStatus",
      wa.reviewed_at as "websiteReviewedAt",
      pp.status as "previewStatus",
      pp.version as "previewVersion",
      ea.blob_url as "visualBlobUrl",
      ea.alt_text as "visualAltText",
      ea.width as "visualWidth",
      ea.height as "visualHeight",
      ea.review_status as "visualReviewStatus",
      ea.created_at as "visualCreatedAt",
      seq.id as "sequenceId",
      seq.status as "sequenceStatus",
      seq.current_step as "sequenceCurrentStep",
      seq.started_at as "sequenceStartedAt",
      seq.stopped_at as "sequenceStoppedAt",
      seq.stop_reason as "sequenceStopReason"
    from growth.prospects p
    inner join growth.businesses b on b.id = p.business_id
    left join growth.contacts c on c.id = p.primary_contact_id
    left join growth.website_assessments wa on wa.prospect_id = p.id
    left join growth.prospect_previews pp on pp.prospect_id = p.id
    left join lateral (
      select id, blob_url, alt_text, width, height, review_status, created_at
      from growth.email_assets
      where prospect_id = p.id and asset_kind = 'cold_first_email'
      order by created_at desc
      limit 1
    ) ea on true
    left join lateral (
      select id, status, current_step, started_at, stopped_at, stop_reason
      from growth.sequence_enrollments
      where prospect_id = p.id
      order by created_at desc
      limit 1
    ) seq on true
    where p.id = ${prospectId}
    limit 1
  `;

  return rows[0] ?? null;
}

async function fetchEvidence(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<ProspectEvidenceItem[]> {
  const rows = await db<
    (Omit<ProspectEvidenceItem, "observedAt" | "verifiedAt"> & {
      observedAt: Date;
      verifiedAt: Date;
    })[]
  >`
    select
      id,
      source_type as "sourceType",
      source_url as "sourceUrl",
      claim_type as "claimType",
      claim_summary as "claimSummary",
      observed_at as "observedAt",
      verified_at as "verifiedAt"
    from growth.source_evidence
    where prospect_id = ${prospectId}
    order by verified_at desc
    limit ${MAX_EVIDENCE_ITEMS}
  `;

  return rows.map((row) => ({
    ...row,
    observedAt: row.observedAt.toISOString(),
    verifiedAt: row.verifiedAt.toISOString(),
  }));
}

async function fetchAuditSummary(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<ProspectAuditEntry[]> {
  const rows = await db<
    (Omit<ProspectAuditEntry, "createdAt"> & { createdAt: Date })[]
  >`
    select action, actor_type as "actorType", created_at as "createdAt"
    from growth.audit_log
    where entity_type = 'prospect' and entity_id = ${prospectId}
    order by created_at desc
    limit ${MAX_AUDIT_ENTRIES}
  `;

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

function toProspectDetail(
  core: CoreRow,
  evidence: readonly ProspectEvidenceItem[],
  auditSummary: readonly ProspectAuditEntry[],
): ProspectDetail {
  const contact: ProspectDetailContact | null =
    core.contactEmail &&
    core.contactFirstName &&
    core.contactLastName &&
    core.contactEmailSourceUrl &&
    core.contactEmailVerifiedAt &&
    core.contactSubscriberType &&
    core.contactLawfulBasis
      ? {
          firstName: core.contactFirstName,
          lastName: core.contactLastName,
          roleTitle: core.contactRoleTitle,
          email: core.contactEmail,
          emailSourceUrl: core.contactEmailSourceUrl,
          emailVerifiedAt: core.contactEmailVerifiedAt.toISOString(),
          subscriberType: core.contactSubscriberType,
          lawfulBasis: core.contactLawfulBasis,
        }
      : null;

  const websiteAssessment: ProspectDetailWebsiteAssessment | null =
    core.websiteBusinessGoal && core.websitePrimaryCta && core.websiteStatus
      ? {
          businessGoal: core.websiteBusinessGoal,
          primaryCta: core.websitePrimaryCta,
          status: core.websiteStatus,
          reviewedAt: core.websiteReviewedAt?.toISOString() ?? null,
        }
      : null;

  const visualAsset: ProspectDetailVisualAsset | null =
    core.visualBlobUrl &&
    core.visualAltText &&
    core.visualWidth &&
    core.visualHeight &&
    core.visualReviewStatus &&
    core.visualCreatedAt
      ? {
          blobUrl: core.visualBlobUrl,
          altText: core.visualAltText,
          width: core.visualWidth,
          height: core.visualHeight,
          reviewStatus: core.visualReviewStatus,
          createdAt: core.visualCreatedAt.toISOString(),
        }
      : null;

  const preview: ProspectDetailPreview | null =
    core.previewStatus && core.previewVersion !== null
      ? { status: core.previewStatus, version: core.previewVersion }
      : null;

  const sequence: ProspectDetailSequence | null =
    core.sequenceId && core.sequenceStatus && core.sequenceCurrentStep !== null
      ? {
          id: core.sequenceId,
          status: core.sequenceStatus,
          currentStep: core.sequenceCurrentStep,
          startedAt: core.sequenceStartedAt?.toISOString() ?? null,
          stoppedAt: core.sequenceStoppedAt?.toISOString() ?? null,
          stopReason: core.sequenceStopReason,
        }
      : null;

  return {
    id: core.id,
    version: core.version,
    status: core.status,
    fitScore: core.fitScore,
    opportunitySummary: core.opportunitySummary,
    recommendedOffer: core.recommendedOffer,
    estimatedOneOffMinPence: core.estimatedOneOffMinPence,
    estimatedOneOffMaxPence: core.estimatedOneOffMaxPence,
    estimatedMonthlyPence: core.estimatedMonthlyPence,
    nextAction: core.nextAction,
    nextActionDueAt: core.nextActionDueAt?.toISOString() ?? null,
    createdAt: core.createdAt.toISOString(),
    business: {
      legalName: core.businessLegalName,
      tradingName: core.businessTradingName,
      companyNumber: core.businessCompanyNumber,
      corporateType: core.businessCorporateType,
      corporateStatus: core.businessCorporateStatus,
      sector: core.businessSector,
      locality: core.businessLocality,
      websiteUrl: core.businessWebsiteUrl,
      googlePlaceId: core.businessGooglePlaceId,
      googleMapsReferenceUrl: core.businessGoogleMapsReferenceUrl,
      verifiedAt: core.businessVerifiedAt.toISOString(),
    },
    contact,
    websiteAssessment,
    preview,
    visualAsset,
    sequence,
    evidence,
    auditSummary,
  };
}

export async function getProspectDetail(
  prospectId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ProspectDetailResult> {
  if (!PROSPECT_ID_PATTERN.test(prospectId)) {
    return { status: "not_found" };
  }

  try {
    const core = await fetchCoreRow(db, prospectId);
    if (!core) return { status: "not_found" };

    const [evidence, auditSummary] = await Promise.all([
      fetchEvidence(db, prospectId),
      fetchAuditSummary(db, prospectId),
    ]);

    return { status: "found", data: toProspectDetail(core, evidence, auditSummary) };
  } catch {
    return {
      status: "error",
      message: "The prospect record could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
