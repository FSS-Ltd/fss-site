import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EVIDENCE_ITEMS = 20;

const sectionSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    summary: z.string().min(1),
    items: z.array(z.string().min(1)),
  })
  .passthrough();

export type AssessmentSection = {
  summary: string;
  items: readonly string[];
};

export type StrategyEvidence = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  claimSummary: string;
  verifiedAt: string;
};

export type ProspectSummary = {
  prospectId: string;
  businessName: string;
  sector: string;
  locality: string;
  fitScore: number;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
};

export type WebsiteStrategyData = ProspectSummary & {
  status: string;
  reviewedAt: string | null;
  businessGoal: string;
  primaryCta: string;
  conversionPlan: AssessmentSection;
  sitemap: AssessmentSection;
  homepageSections: AssessmentSection;
  trustSignals: AssessmentSection;
  localSeoPlan: AssessmentSection;
  technologyPlan: AssessmentSection;
  futureOpportunities: AssessmentSection;
  evidence: readonly StrategyEvidence[];
};

export type VisualConceptAsset = {
  url: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  sha256: string;
  reviewStatus: string;
  createdBy: string;
  createdAt: string;
};

export type VisualConceptData = ProspectSummary & {
  status: string;
  reviewedAt: string | null;
  heroConcept: AssessmentSection;
  mobileFallback: AssessmentSection;
  performanceBudget: AssessmentSection;
  asset: VisualConceptAsset | null;
};

export type WebsiteStrategyResult =
  | { status: "ready"; data: WebsiteStrategyData }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

export type VisualConceptResult =
  | { status: "ready"; data: VisualConceptData }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

type AssessmentRow = {
  businessGoal: string;
  primaryCta: string;
  sitemap: unknown;
  homepageSections: unknown;
  conversionPlan: unknown;
  localSeoPlan: unknown;
  trustSignals: unknown;
  technologyPlan: unknown;
  futureOpportunities: unknown;
  heroConcept: unknown;
  mobileFallback: unknown;
  performanceBudget: unknown;
  status: string;
  reviewedAt: Date | null;
  businessName: string;
  sector: string;
  locality: string;
  fitScore: number;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
};

async function fetchAssessmentRow(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<AssessmentRow | null> {
  const rows = await db<AssessmentRow[]>`
    select
      wa.business_goal as "businessGoal",
      wa.primary_cta as "primaryCta",
      wa.sitemap,
      wa.homepage_sections as "homepageSections",
      wa.conversion_plan as "conversionPlan",
      wa.local_seo_plan as "localSeoPlan",
      wa.trust_signals as "trustSignals",
      wa.technology_plan as "technologyPlan",
      wa.future_opportunities as "futureOpportunities",
      wa.hero_concept as "heroConcept",
      wa.mobile_fallback as "mobileFallback",
      wa.performance_budget as "performanceBudget",
      wa.status,
      wa.reviewed_at as "reviewedAt",
      b.legal_name as "businessName",
      b.sector,
      b.locality,
      p.fit_score as "fitScore",
      p.recommended_offer as "recommendedOffer",
      p.estimated_one_off_min_pence as "estimatedOneOffMinPence",
      p.estimated_one_off_max_pence as "estimatedOneOffMaxPence"
    from growth.website_assessments wa
    inner join growth.prospects p on p.id = wa.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    where wa.prospect_id = ${prospectId}
    limit 1
  `;
  return rows[0] ?? null;
}

async function fetchEvidence(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<StrategyEvidence[]> {
  const rows = await db<
    (Omit<StrategyEvidence, "verifiedAt"> & { verifiedAt: Date })[]
  >`
    select
      id,
      source_type as "sourceType",
      source_url as "sourceUrl",
      claim_summary as "claimSummary",
      verified_at as "verifiedAt"
    from growth.source_evidence
    where prospect_id = ${prospectId}
    order by verified_at desc
    limit ${MAX_EVIDENCE_ITEMS}
  `;
  return rows.map((row) => ({ ...row, verifiedAt: row.verifiedAt.toISOString() }));
}

type VisualAssetRow = {
  url: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  sha256: string;
  reviewStatus: string;
  createdBy: string;
  createdAt: Date;
};

async function fetchVisualAsset(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<VisualConceptAsset | null> {
  const rows = await db<VisualAssetRow[]>`
    select
      blob_url as "url",
      width,
      height,
      byte_size as "byteSize",
      alt_text as "altText",
      sha256,
      review_status as "reviewStatus",
      created_by as "createdBy",
      created_at as "createdAt"
    from growth.email_assets
    where prospect_id = ${prospectId} and asset_kind = 'cold_first_email'
    order by created_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function parseSection(value: unknown): AssessmentSection {
  const parsed = sectionSchema.parse(value);
  return { summary: parsed.summary, items: parsed.items };
}

function prospectSummaryFrom(row: AssessmentRow, prospectId: string): ProspectSummary {
  return {
    prospectId,
    businessName: row.businessName,
    sector: row.sector,
    locality: row.locality,
    fitScore: row.fitScore,
    recommendedOffer: row.recommendedOffer,
    estimatedOneOffMinPence: row.estimatedOneOffMinPence,
    estimatedOneOffMaxPence: row.estimatedOneOffMaxPence,
  };
}

export async function getWebsiteStrategy(
  prospectId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<WebsiteStrategyResult> {
  if (!PROSPECT_ID_PATTERN.test(prospectId)) {
    return { status: "not_found" };
  }

  try {
    const row = await fetchAssessmentRow(db, prospectId);
    if (!row) return { status: "not_found" };

    const evidence = await fetchEvidence(db, prospectId);

    return {
      status: "ready",
      data: {
        ...prospectSummaryFrom(row, prospectId),
        status: row.status,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        businessGoal: row.businessGoal,
        primaryCta: row.primaryCta,
        conversionPlan: parseSection(row.conversionPlan),
        sitemap: parseSection(row.sitemap),
        homepageSections: parseSection(row.homepageSections),
        trustSignals: parseSection(row.trustSignals),
        localSeoPlan: parseSection(row.localSeoPlan),
        technologyPlan: parseSection(row.technologyPlan),
        futureOpportunities: parseSection(row.futureOpportunities),
        evidence,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The website strategy could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export async function getVisualConcept(
  prospectId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<VisualConceptResult> {
  if (!PROSPECT_ID_PATTERN.test(prospectId)) {
    return { status: "not_found" };
  }

  try {
    const row = await fetchAssessmentRow(db, prospectId);
    if (!row) return { status: "not_found" };

    const asset = await fetchVisualAsset(db, prospectId);

    return {
      status: "ready",
      data: {
        ...prospectSummaryFrom(row, prospectId),
        status: row.status,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        heroConcept: parseSection(row.heroConcept),
        mobileFallback: parseSection(row.mobileFallback),
        performanceBudget: parseSection(row.performanceBudget),
        asset,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The visual concept could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
