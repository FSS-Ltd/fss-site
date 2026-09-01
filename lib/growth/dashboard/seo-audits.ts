import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import { scheduleFollowUp } from "../sequences/schedule";
import {
  listSeoAuditDrafts,
  type SeoAuditListRow,
} from "../seo-audits/repository";
import {
  parseStoredSeoAuditDraft,
  type StoredSeoAuditDraft,
} from "../seo-audits/schema";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SeoAuditListResult =
  | { status: "ready"; rows: readonly SeoAuditListRow[] }
  | { status: "error"; message: string; correlationId: string };

export async function getSeoAuditList(
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = randomUUID,
): Promise<SeoAuditListResult> {
  try {
    return { status: "ready", rows: await listSeoAuditDrafts(db) };
  } catch {
    return {
      status: "error",
      message: "SEO audit drafts could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export type SeoAuditReviewData = {
  auditId: string;
  version: number;
  status: "draft" | "approved" | "cancelled" | "claimed";
  businessName: string;
  websiteUrl: string;
  contactName: string;
  contactEmail: string;
  reportUrl: string;
  completedAt: string;
  scheduledFor: string;
  email: StoredSeoAuditDraft["email"];
  audit: StoredSeoAuditDraft["audit"];
  eligibility: { ready: boolean; reasons: readonly string[] };
};

export type SeoAuditReviewResult =
  | { status: "ready"; data: SeoAuditReviewData }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "error"; message: string; correlationId: string };

type ReviewRow = {
  auditId: string;
  version: number;
  status: SeoAuditReviewData["status"];
  outputSnapshot: unknown;
  businessName: string;
  websiteUrl: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  completedAt: Date | null;
  firstSentAt: Date | null;
  sequenceStatus: string;
  secondFollowUpSent: boolean;
  hasInboundReply: boolean;
  isSuppressed: boolean;
  subscriberType: string;
  corporateStatus: string;
};

function eligibility(row: ReviewRow, draft: StoredSeoAuditDraft) {
  const reasons: string[] = [];
  if (row.status !== "draft" || draft.reviewState !== "draft") {
    reasons.push("This audit draft is no longer awaiting approval.");
  }
  if (row.sequenceStatus !== "active") {
    reasons.push("The outreach sequence is no longer active.");
  }
  if (!row.secondFollowUpSent) {
    reasons.push("The second follow-up has not been sent.");
  }
  if (row.hasInboundReply) {
    reasons.push("The prospect replied, so this follow-up must not be sent.");
  }
  if (row.isSuppressed) {
    reasons.push("This contact is suppressed.");
  }
  if (row.subscriberType !== "corporate" || row.corporateStatus !== "active") {
    reasons.push("This is no longer an eligible active corporate contact.");
  }
  if (row.firstSentAt === null) {
    reasons.push("The original send time is missing.");
  }
  return { ready: reasons.length === 0, reasons };
}

export async function getSeoAuditReview(
  auditId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = randomUUID,
): Promise<SeoAuditReviewResult> {
  if (!UUID_PATTERN.test(auditId)) return { status: "invalid" };

  try {
    const rows = await db<ReviewRow[]>`
      select
        audit.id as "auditId",
        audit.version,
        audit.status,
        audit.output_snapshot as "outputSnapshot",
        b.legal_name as "businessName",
        b.website_url as "websiteUrl",
        c.first_name as "contactFirstName",
        c.last_name as "contactLastName",
        c.email as "contactEmail",
        audit.completed_at as "completedAt",
        first_message.sent_at as "firstSentAt",
        se.status as "sequenceStatus",
        exists (
          select 1 from growth.email_messages second_follow_up
          where second_follow_up.sequence_enrollment_id = se.id
            and second_follow_up.direction = 'outbound'
            and second_follow_up.step_number = 1
            and second_follow_up.status = 'sent'
        ) as "secondFollowUpSent",
        exists (
          select 1 from growth.email_messages inbound
          where inbound.sequence_enrollment_id = se.id
            and inbound.direction = 'inbound'
            and inbound.status = 'received'
        ) as "hasInboundReply",
        exists (
          select 1 from growth.suppressions suppression
          where suppression.normalised_email = c.normalised_email
        ) as "isSuppressed",
        c.subscriber_type as "subscriberType",
        b.corporate_status as "corporateStatus"
      from growth.seo_audit_drafts audit
      inner join growth.sequence_enrollments se
        on se.id = audit.sequence_enrollment_id
      inner join growth.prospects p on p.id = audit.prospect_id
      inner join growth.businesses b on b.id = p.business_id
      inner join growth.contacts c on c.id = se.contact_id
      left join growth.email_messages first_message
        on first_message.id = se.first_message_id
      where audit.id = ${auditId}
      limit 1
    `;
    const row = rows[0];
    if (!row) return { status: "not_found" };

    let draft: StoredSeoAuditDraft;
    try {
      draft = parseStoredSeoAuditDraft(row.outputSnapshot);
    } catch {
      return { status: "invalid" };
    }
    if (
      row.completedAt === null ||
      row.firstSentAt === null ||
      !row.websiteUrl
    ) {
      return { status: "invalid" };
    }

    return {
      status: "ready",
      data: {
        auditId: row.auditId,
        version: row.version,
        status: row.status,
        businessName: row.businessName,
        websiteUrl: row.websiteUrl,
        contactName: `${row.contactFirstName} ${row.contactLastName}`.trim(),
        contactEmail: row.contactEmail,
        reportUrl: draft.reportUrl,
        completedAt: row.completedAt.toISOString(),
        scheduledFor: scheduleFollowUp(row.firstSentAt, "day_11").toISOString(),
        email: draft.email,
        audit: draft.audit,
        eligibility: eligibility(row, draft),
      },
    };
  } catch {
    return {
      status: "error",
      message: "The SEO audit draft could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
