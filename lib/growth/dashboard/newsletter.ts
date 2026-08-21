import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import { computeIssueChecksum } from "../newsletter/issues";
import type { NewsletterIssueStatus } from "../newsletter/issues";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- Issue list --------------------------------------------------------

export type NewsletterIssueListRow = {
  issueId: string;
  issueKey: string;
  subject: string;
  status: NewsletterIssueStatus;
  version: number;
  scheduledFor: string | null;
  sentAt: string | null;
  updatedAt: string;
};

export type NewsletterIssueListResult =
  | { status: "ready"; rows: readonly NewsletterIssueListRow[] }
  | { status: "error"; message: string; correlationId: string };

type IssueListSqlRow = {
  issueId: string;
  issueKey: string;
  subject: string;
  status: NewsletterIssueStatus;
  version: number;
  scheduledFor: Date | null;
  sentAt: Date | null;
  updatedAt: Date;
};

export async function getNewsletterIssueList(
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<NewsletterIssueListResult> {
  try {
    const rows = await db<IssueListSqlRow[]>`
      select
        id as "issueId",
        issue_key as "issueKey",
        subject,
        status,
        version,
        scheduled_for as "scheduledFor",
        sent_at as "sentAt",
        updated_at as "updatedAt"
      from growth.newsletter_issues
      order by updated_at desc
      limit 50
    `;

    return {
      status: "ready",
      rows: rows.map((row) => ({
        ...row,
        scheduledFor: row.scheduledFor?.toISOString() ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  } catch {
    return {
      status: "error",
      message: "The newsletter issue list could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

// --- Issue review --------------------------------------------------------

export type NewsletterAudienceSummary = {
  eligibleCount: number;
  suppressedCount: number;
  pendingCount: number;
};

export type NewsletterIssueAsset = {
  url: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  reviewStatus: string;
};

export type NewsletterIssueReview = {
  issueId: string;
  issueKey: string;
  version: number;
  status: NewsletterIssueStatus;
  subject: string;
  previewText: string;
  htmlSnapshot: string;
  textSnapshot: string;
  checksum: string;
  fromEmail: string | null;
  replyToEmail: string | null;
  audience: NewsletterAudienceSummary;
  asset: NewsletterIssueAsset | null;
  testSentAt: string | null;
  testSentVersion: number | null;
  isTestCurrent: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  approvedChecksum: string | null;
  isApprovalCurrent: boolean;
  isLocked: boolean;
  scheduledFor: string | null;
  sentAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterIssueReviewResult =
  | { status: "ready"; data: NewsletterIssueReview }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

type IssueReviewSqlRow = {
  issueId: string;
  issueKey: string;
  version: number;
  status: NewsletterIssueStatus;
  subject: string;
  previewText: string;
  htmlSnapshot: string;
  textSnapshot: string;
  emailAssetId: string | null;
  testSentAt: Date | null;
  testSentVersion: number | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  approvedChecksum: string | null;
  scheduledFor: Date | null;
  sentAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

const LOCKED_STATUSES = new Set<NewsletterIssueStatus>([
  "approved",
  "scheduled",
  "sending",
  "sent",
]);

async function fetchIssueRow(
  db: GrowthQueryExecutor,
  issueId: string,
): Promise<IssueReviewSqlRow | null> {
  const rows = await db<IssueReviewSqlRow[]>`
    select
      id as "issueId",
      issue_key as "issueKey",
      version,
      status,
      subject,
      preview_text as "previewText",
      html_snapshot as "htmlSnapshot",
      text_snapshot as "textSnapshot",
      email_asset_id as "emailAssetId",
      test_sent_at as "testSentAt",
      test_sent_version as "testSentVersion",
      approved_at as "approvedAt",
      approved_by as "approvedBy",
      approved_checksum as "approvedChecksum",
      scheduled_for as "scheduledFor",
      sent_at as "sentAt",
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from growth.newsletter_issues
    where id = ${issueId}
  `;
  return rows[0] ?? null;
}

type AssetSqlRow = {
  url: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  reviewStatus: string;
};

async function fetchAsset(
  db: GrowthQueryExecutor,
  assetId: string,
): Promise<NewsletterIssueAsset | null> {
  const rows = await db<AssetSqlRow[]>`
    select
      blob_url as "url",
      width,
      height,
      byte_size as "byteSize",
      alt_text as "altText",
      review_status as "reviewStatus"
    from growth.email_assets
    where id = ${assetId}
  `;
  return rows[0] ?? null;
}

async function fetchAudienceSummary(
  db: GrowthQueryExecutor,
): Promise<NewsletterAudienceSummary> {
  const rows = await db<{ status: string; count: string }[]>`
    select status, count(*)::text as count
    from growth.newsletter_subscribers
    group by status
  `;

  let eligibleCount = 0;
  let suppressedCount = 0;
  let pendingCount = 0;

  for (const row of rows) {
    const count = Number(row.count);
    if (row.status === "subscribed") eligibleCount += count;
    else if (row.status === "pending") pendingCount += count;
    else suppressedCount += count;
  }

  return { eligibleCount, suppressedCount, pendingCount };
}

export async function getNewsletterIssueReview(
  issueId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<NewsletterIssueReviewResult> {
  if (!UUID_PATTERN.test(issueId)) {
    return { status: "not_found" };
  }

  try {
    const row = await fetchIssueRow(db, issueId);
    if (!row) return { status: "not_found" };

    const [asset, audience] = await Promise.all([
      row.emailAssetId ? fetchAsset(db, row.emailAssetId) : Promise.resolve(null),
      fetchAudienceSummary(db),
    ]);

    const checksum = computeIssueChecksum(row.htmlSnapshot, row.textSnapshot);

    return {
      status: "ready",
      data: {
        issueId: row.issueId,
        issueKey: row.issueKey,
        version: row.version,
        status: row.status,
        subject: row.subject,
        previewText: row.previewText,
        htmlSnapshot: row.htmlSnapshot,
        textSnapshot: row.textSnapshot,
        checksum,
        fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || null,
        replyToEmail: process.env.RESEND_REPLY_TO_EMAIL?.trim() || null,
        audience,
        asset,
        testSentAt: row.testSentAt?.toISOString() ?? null,
        testSentVersion: row.testSentVersion,
        isTestCurrent: row.testSentVersion === row.version,
        approvedAt: row.approvedAt?.toISOString() ?? null,
        approvedBy: row.approvedBy,
        approvedChecksum: row.approvedChecksum,
        isApprovalCurrent: row.approvedChecksum === checksum,
        isLocked: LOCKED_STATUSES.has(row.status),
        scheduledFor: row.scheduledFor?.toISOString() ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  } catch {
    return {
      status: "error",
      message: "The newsletter issue could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

// --- Site-email templates --------------------------------------------------

export type EmailTemplateSummary = {
  templateId: string;
  templateKey: string;
  category: string | null;
  status: string;
  version: string;
  publishedAt: string | null;
  publishedBy: string | null;
};

export type EmailTemplateListResult =
  | { status: "ready"; rows: readonly EmailTemplateSummary[] }
  | { status: "error"; message: string; correlationId: string };

type TemplateListSqlRow = {
  templateId: string;
  templateKey: string;
  category: string | null;
  status: string;
  version: string;
  publishedAt: Date | null;
  publishedBy: string | null;
};

export async function getEmailTemplateList(
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<EmailTemplateListResult> {
  try {
    const rows = await db<TemplateListSqlRow[]>`
      select
        id as "templateId",
        template_key as "templateKey",
        category,
        status,
        version,
        published_at as "publishedAt",
        published_by as "publishedBy"
      from growth.email_templates
      where channel = 'resend'
      order by template_key asc
    `;

    return {
      status: "ready",
      rows: rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      })),
    };
  } catch {
    return {
      status: "error",
      message: "The email template list could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

/** Safe, representative values for every placeholder used across the
 * seeded resend templates. Never real subscriber or client data. */
const FIXTURE_FIELDS: Readonly<Record<string, string>> = {
  firstName: "Daniel",
  businessName: "Smith & Sons Plumbing Ltd",
  resourceTitle: "The Practical Process Audit Guide",
  resourceUrl:
    "https://faithfulsoftwaresolutions.co.uk/resources/manual-process-audit-fss",
  engagementName: "the enquiry workflow rebuild",
  newsletterOptInUrl: "https://faithfulsoftwaresolutions.co.uk/#newsletter",
};

function fillTemplatePlaceholders(
  template: string,
  fixtureFields: Readonly<Record<string, string>>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (match, field: string) => fixtureFields[field] ?? match,
  );
}

export type EmailTemplateReview = EmailTemplateSummary & {
  requiredFields: readonly string[];
  renderedSubject: string | null;
  renderedHtml: string;
  renderedText: string;
  checksum: string;
  fixtureFields: Readonly<Record<string, string>>;
};

export type EmailTemplateReviewResult =
  | { status: "ready"; data: EmailTemplateReview }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

type TemplateReviewSqlRow = TemplateListSqlRow & {
  subjectTemplate: string | null;
  htmlTemplate: string;
  textTemplate: string;
  requiredFields: string[];
  checksum: string;
};

export async function getEmailTemplateReview(
  templateId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<EmailTemplateReviewResult> {
  if (!UUID_PATTERN.test(templateId)) {
    return { status: "not_found" };
  }

  try {
    const rows = await db<TemplateReviewSqlRow[]>`
      select
        id as "templateId",
        template_key as "templateKey",
        category,
        status,
        version,
        published_at as "publishedAt",
        published_by as "publishedBy",
        subject_template as "subjectTemplate",
        html_template as "htmlTemplate",
        text_template as "textTemplate",
        required_fields as "requiredFields",
        checksum
      from growth.email_templates
      where id = ${templateId} and channel = 'resend'
    `;
    const row = rows[0];
    if (!row) return { status: "not_found" };

    const fixtureFields: Record<string, string> = Object.fromEntries(
      row.requiredFields.map((field) => [field, FIXTURE_FIELDS[field] ?? `[${field}]`]),
    );

    return {
      status: "ready",
      data: {
        templateId: row.templateId,
        templateKey: row.templateKey,
        category: row.category,
        status: row.status,
        version: row.version,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        publishedBy: row.publishedBy,
        requiredFields: row.requiredFields,
        renderedSubject: row.subjectTemplate
          ? fillTemplatePlaceholders(row.subjectTemplate, fixtureFields)
          : null,
        renderedHtml: fillTemplatePlaceholders(row.htmlTemplate, fixtureFields),
        renderedText: fillTemplatePlaceholders(row.textTemplate, fixtureFields),
        checksum: row.checksum,
        fixtureFields,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The email template could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
