import { randomUUID } from "node:crypto";

import { renderApprovedFirstEmailContent } from "../email/gmail/render";
import { EMAIL_ASSET_FALLBACK_KEYS } from "../email/assets/fallbacks";
import type { EmailAssetFallbackKey } from "../email/assets/fallbacks";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import {
  InvalidStoredFirstEmailDraftError,
  parseStoredFirstEmailDraft,
  type StoredFirstEmailVisual,
} from "../sequences/first-email-draft-snapshot";

const DRAFT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CITATIONS = 20;

export const FOLLOW_UP_CADENCE = [
  { day: "Day 1", label: "Personalised email" },
  { day: "Day 5", label: "Short follow-up" },
  { day: "Day 11", label: "Founder-approved SEO and AEO audit" },
  { day: "Day 14", label: "Close the loop" },
] as const;

export type MessageReviewCitation = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  claimSummary: string;
  verifiedAt: string;
};

export type MessageReviewEligibility = {
  ready: boolean;
  reasons: readonly string[];
};

export type MessageReviewData = {
  draftTaskId: string;
  version: number;
  revisionCount: number;
  prospectId: string;
  prospectVersion: number;
  businessName: string;
  websiteUrl: string | null;
  fitScore: number;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
  contactName: string;
  contactEmail: string;
  founderEmail: string;
  subject: string;
  previewHtml: string;
  previewText: string;
  editableParagraphs: readonly string[];
  wordCount: number;
  imageAltText: string;
  imageByteSize: number | null;
  visualKind: "stored" | "fallback";
  visualReviewStatus: string | null;
  citations: readonly MessageReviewCitation[];
  createdAt: string;
  eligibility: MessageReviewEligibility;
  followUpCadence: typeof FOLLOW_UP_CADENCE;
};

export type MessageReviewResult =
  | { status: "ready"; data: MessageReviewData }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string; correlationId: string };

type DraftRow = {
  id: string;
  prospectId: string;
  status: string;
  outputSnapshot: unknown;
  completedAt: Date | null;
  businessName: string;
  websiteUrl: string | null;
  prospectVersion: number;
  fitScore: number;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  normalisedEmail: string;
  subscriberType: string;
  corporateStatus: string;
};

async function fetchDraftRow(
  db: GrowthQueryExecutor,
  draftTaskId: string,
): Promise<DraftRow | null> {
  const rows = await db<DraftRow[]>`
    select
      at.id,
      at.prospect_id as "prospectId",
      at.status,
      at.output_snapshot as "outputSnapshot",
      at.completed_at as "completedAt",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl",
      p.version as "prospectVersion",
      p.fit_score as "fitScore",
      p.recommended_offer as "recommendedOffer",
      p.estimated_one_off_min_pence as "estimatedOneOffMinPence",
      p.estimated_one_off_max_pence as "estimatedOneOffMaxPence",
      c.first_name as "contactFirstName",
      c.last_name as "contactLastName",
      c.email as "contactEmail",
      c.normalised_email as "normalisedEmail",
      c.subscriber_type as "subscriberType",
      b.corporate_status as "corporateStatus"
    from growth.agent_tasks at
    inner join growth.prospects p on p.id = at.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    inner join growth.contacts c on c.id = p.primary_contact_id
    where at.id = ${draftTaskId}
      and at.task_type = 'first_email_draft'
    limit 1
  `;

  return rows[0] ?? null;
}

async function fetchHasEnrollment(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<boolean> {
  const rows = await db<{ exists: boolean }[]>`
    select exists (
      select 1 from growth.sequence_enrollments where prospect_id = ${prospectId}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function fetchSuppressed(
  db: GrowthQueryExecutor,
  normalisedEmail: string,
): Promise<boolean> {
  const rows = await db<{ exists: boolean }[]>`
    select exists (
      select 1 from growth.suppressions where normalised_email = ${normalisedEmail}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function fetchEmailAsset(
  db: GrowthQueryExecutor,
  assetId: string,
  prospectId: string,
): Promise<{
  url: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  reviewStatus: string;
} | null> {
  const rows = await db<
    {
      url: string;
      width: number;
      height: number;
      byteSize: number;
      altText: string;
      reviewStatus: string;
    }[]
  >`
    select
      blob_url as "url",
      width,
      height,
      byte_size as "byteSize",
      alt_text as "altText",
      review_status as "reviewStatus"
    from growth.email_assets
    where id = ${assetId} and prospect_id = ${prospectId}
  `;
  return rows[0] ?? null;
}

async function fetchCitations(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<MessageReviewCitation[]> {
  return db<MessageReviewCitation[]>`
    select
      id,
      source_type as "sourceType",
      source_url as "sourceUrl",
      claim_summary as "claimSummary",
      verified_at as "verifiedAt"
    from growth.source_evidence
    where prospect_id = ${prospectId}
    order by verified_at desc
    limit ${MAX_CITATIONS}
  `;
}

function isFallbackKey(value: string): value is EmailAssetFallbackKey {
  return (EMAIL_ASSET_FALLBACK_KEYS as readonly string[]).includes(value);
}

type ResolvedVisual = {
  renderable: Parameters<typeof renderApprovedFirstEmailContent>[0]["visual"];
  altText: string;
  byteSize: number | null;
  reviewStatus: string | null;
};

async function resolveVisualForPreview(
  db: GrowthQueryExecutor,
  prospectId: string,
  visual: StoredFirstEmailVisual,
  siteOrigin: string,
): Promise<ResolvedVisual | null> {
  if (visual.kind === "fallback") {
    if (!isFallbackKey(visual.fallbackAssetKey)) return null;
    return {
      renderable: {
        kind: "fallback",
        fallbackKey: visual.fallbackAssetKey,
        siteOrigin,
        conceptDisclaimer: visual.conceptDisclaimer,
      },
      altText: visual.altText,
      byteSize: null,
      reviewStatus: null,
    };
  }

  const asset = await fetchEmailAsset(db, visual.assetId, prospectId);
  if (!asset) return null;

  return {
    renderable: {
      kind: "approved",
      assetId: visual.assetId,
      url: asset.url,
      width: asset.width,
      height: asset.height,
      byteSize: asset.byteSize,
      altText: asset.altText,
      conceptDisclaimer: visual.conceptDisclaimer,
    },
    altText: asset.altText,
    byteSize: asset.byteSize,
    reviewStatus: asset.reviewStatus,
  };
}

export async function getMessageReview(
  draftTaskId: string,
  founderEmail: string,
  siteOrigin: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<MessageReviewResult> {
  if (!DRAFT_ID_PATTERN.test(draftTaskId)) {
    return { status: "unavailable", reason: "This draft could not be found." };
  }

  try {
    const draft = await fetchDraftRow(db, draftTaskId);
    if (!draft) {
      return {
        status: "unavailable",
        reason: "This draft could not be found.",
      };
    }

    let stored;
    try {
      stored = parseStoredFirstEmailDraft({
        id: draft.id,
        prospectId: draft.prospectId,
        status: draft.status,
        outputSnapshot: draft.outputSnapshot,
        completedAt: draft.completedAt,
        hasEnrollment: false,
      });
    } catch (error) {
      if (error instanceof InvalidStoredFirstEmailDraftError) {
        return {
          status: "unavailable",
          reason: "This draft is corrupted and cannot be reviewed safely.",
        };
      }
      throw error;
    }

    const [hasEnrollment, suppressed] = await Promise.all([
      fetchHasEnrollment(db, draft.prospectId),
      fetchSuppressed(db, draft.normalisedEmail),
    ]);

    if (
      draft.status !== "completed" ||
      stored.reviewState !== "draft" ||
      hasEnrollment
    ) {
      return {
        status: "unavailable",
        reason:
          "This email has already been reviewed and can no longer be edited here.",
      };
    }

    const [resolvedVisual, citations] = await Promise.all([
      resolveVisualForPreview(db, draft.prospectId, stored.visual, siteOrigin),
      fetchCitations(db, draft.prospectId),
    ]);

    if (!resolvedVisual) {
      return {
        status: "unavailable",
        reason:
          "The generated image for this draft is missing and must be resolved before review.",
      };
    }

    let content;
    try {
      content = renderApprovedFirstEmailContent({
        snapshot: stored.email,
        visual: resolvedVisual.renderable,
      });
    } catch {
      return {
        status: "unavailable",
        reason:
          "This draft's copy or image failed safety validation and cannot be reviewed as-is.",
      };
    }

    const reasons: string[] = [];
    if (suppressed) {
      reasons.push("This contact is suppressed and cannot be emailed.");
    }
    if (
      draft.subscriberType !== "corporate" ||
      draft.corporateStatus !== "active"
    ) {
      reasons.push("This contact is not an eligible corporate subscriber.");
    }
    if (
      resolvedVisual.reviewStatus !== null &&
      resolvedVisual.reviewStatus !== "approved"
    ) {
      reasons.push("The selected image has not been approved yet.");
    }

    return {
      status: "ready",
      data: {
        draftTaskId: draft.id,
        version: stored.version,
        revisionCount: stored.revisions.length,
        prospectId: draft.prospectId,
        prospectVersion: draft.prospectVersion,
        businessName: draft.businessName,
        websiteUrl: draft.websiteUrl,
        fitScore: draft.fitScore,
        recommendedOffer: draft.recommendedOffer,
        estimatedOneOffMinPence: draft.estimatedOneOffMinPence,
        estimatedOneOffMaxPence: draft.estimatedOneOffMaxPence,
        contactName: `${draft.contactFirstName} ${draft.contactLastName}`,
        contactEmail: draft.contactEmail,
        founderEmail,
        subject: content.subject,
        previewHtml: content.html,
        previewText: content.text,
        editableParagraphs: stored.email.text.split(/\n{2,}/),
        wordCount: stored.email.wordCount,
        imageAltText: resolvedVisual.altText,
        imageByteSize: resolvedVisual.byteSize,
        visualKind: stored.visual.kind,
        visualReviewStatus: resolvedVisual.reviewStatus,
        citations,
        createdAt: (draft.completedAt ?? new Date()).toISOString(),
        eligibility: { ready: reasons.length === 0, reasons },
        followUpCadence: FOLLOW_UP_CADENCE,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The email draft could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
