import { createHash } from "node:crypto";

import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthQueryExecutor } from "../db/types";

import type { SeoAuditBlobStorage } from "./blob";
import { renderSeoAuditPdf } from "./pdf";
import { parseStoredSeoAuditDraft, type StoredSeoAuditDraft } from "./schema";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SeoAuditReportRegenerationErrorCode =
  | "not_found"
  | "not_regenerable"
  | "version_conflict"
  | "invalid_stored_draft";

export class SeoAuditReportRegenerationError extends Error {
  constructor(readonly code: SeoAuditReportRegenerationErrorCode) {
    super("The SEO audit report could not be regenerated.");
    this.name = "SeoAuditReportRegenerationError";
  }
}

type RegenerationRow = {
  auditId: string;
  version: number;
  status: string;
  outputSnapshot: unknown;
  reportUrl: string | null;
  reportSha256: string | null;
  completedAt: Date | null;
  businessName: string;
  websiteUrl: string;
};

type PreparedRegeneration = {
  row: RegenerationRow;
  stored: StoredSeoAuditDraft;
};

async function getRegenerationRow(
  db: GrowthQueryExecutor,
  auditId: string,
  lock = false,
): Promise<RegenerationRow | null> {
  const select = lock
    ? db<RegenerationRow[]>`
    select
      audit.id as "auditId",
      audit.version,
      audit.status,
      audit.output_snapshot as "outputSnapshot",
      audit.report_url as "reportUrl",
      audit.report_sha256 as "reportSha256",
      audit.completed_at as "completedAt",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl"
    from growth.seo_audit_drafts audit
    inner join growth.prospects p on p.id = audit.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    where audit.id = ${auditId}
    limit 1
    for update of audit
  `
    : db<RegenerationRow[]>`
    select
      audit.id as "auditId",
      audit.version,
      audit.status,
      audit.output_snapshot as "outputSnapshot",
      audit.report_url as "reportUrl",
      audit.report_sha256 as "reportSha256",
      audit.completed_at as "completedAt",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl"
    from growth.seo_audit_drafts audit
    inner join growth.prospects p on p.id = audit.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    where audit.id = ${auditId}
    limit 1
  `;
  const rows = await select;
  return rows[0] ?? null;
}

function prepareRegeneration(row: RegenerationRow): PreparedRegeneration {
  if (row.status !== "draft") {
    throw new SeoAuditReportRegenerationError("not_regenerable");
  }
  if (
    row.completedAt === null ||
    !row.websiteUrl ||
    row.reportUrl === null ||
    row.reportSha256 === null
  ) {
    throw new SeoAuditReportRegenerationError("invalid_stored_draft");
  }

  let stored: StoredSeoAuditDraft;
  try {
    stored = parseStoredSeoAuditDraft(row.outputSnapshot);
  } catch {
    throw new SeoAuditReportRegenerationError("invalid_stored_draft");
  }
  if (
    stored.version !== row.version ||
    stored.reportUrl !== row.reportUrl ||
    stored.reportSha256 !== row.reportSha256
  ) {
    throw new SeoAuditReportRegenerationError("invalid_stored_draft");
  }
  return { row, stored };
}

function withRegeneratedReport(
  stored: StoredSeoAuditDraft,
  reportUrl: string,
  reportSha256: string,
): StoredSeoAuditDraft {
  if (
    !stored.email.html.includes(stored.reportUrl) ||
    !stored.email.text.includes(stored.reportUrl)
  ) {
    throw new SeoAuditReportRegenerationError("invalid_stored_draft");
  }

  const regenerated = {
    ...stored,
    version: stored.version + 1,
    reportUrl,
    reportSha256,
    email: {
      ...stored.email,
      html: stored.email.html.replaceAll(stored.reportUrl, reportUrl),
      text: stored.email.text.replaceAll(stored.reportUrl, reportUrl),
    },
  } satisfies StoredSeoAuditDraft;

  try {
    return parseStoredSeoAuditDraft(regenerated);
  } catch {
    throw new SeoAuditReportRegenerationError("invalid_stored_draft");
  }
}

async function persistRegeneratedReport(
  db: GrowthDb,
  input: {
    prepared: PreparedRegeneration;
    reportUrl: string;
    reportSha256: string;
    correlationId: string;
    now: Date;
  },
): Promise<string> {
  return withGrowthTransaction(db, async (transaction) => {
    const current = await getRegenerationRow(
      transaction,
      input.prepared.row.auditId,
      true,
    );
    if (current === null) {
      throw new SeoAuditReportRegenerationError("not_found");
    }
    if (
      current.version !== input.prepared.row.version ||
      current.status !== "draft" ||
      current.reportSha256 !== input.prepared.row.reportSha256
    ) {
      throw new SeoAuditReportRegenerationError("version_conflict");
    }

    const regenerated = withRegeneratedReport(
      input.prepared.stored,
      input.reportUrl,
      input.reportSha256,
    );
    const updated = await transaction<{ id: string }[]>`
      update growth.seo_audit_drafts
      set output_snapshot = ${transaction.json(regenerated)},
          report_url = ${regenerated.reportUrl},
          report_sha256 = ${regenerated.reportSha256},
          version = ${regenerated.version},
          updated_at = ${input.now}
      where id = ${input.prepared.row.auditId}
        and status = 'draft'
        and version = ${input.prepared.row.version}
      returning id
    `;
    if (updated.length !== 1) {
      throw new SeoAuditReportRegenerationError("version_conflict");
    }
    await appendAuditEvent(transaction, {
      correlationId: input.correlationId,
      actorType: "agent",
      actorId: "seo-audit-agent-v1",
      action: "seo_audit.report_regenerated",
      entityType: "seo_audit_draft",
      entityId: input.prepared.row.auditId,
      metadata: { reasonCode: "pdf_pagination_repair" },
    });
    return input.prepared.stored.reportUrl;
  });
}

export async function regenerateSeoAuditReports(input: {
  db: GrowthDb;
  blobStorage: SeoAuditBlobStorage;
  auditIds: readonly string[];
  correlationId: string;
  now: Date;
  renderPdf?: typeof renderSeoAuditPdf;
}): Promise<number> {
  if (
    input.auditIds.length === 0 ||
    input.auditIds.length > 5 ||
    new Set(input.auditIds).size !== input.auditIds.length ||
    !input.auditIds.every((auditId) => UUID_PATTERN.test(auditId))
  ) {
    throw new TypeError("SEO audit regeneration request is invalid.");
  }

  const renderPdf = input.renderPdf ?? renderSeoAuditPdf;
  for (const auditId of input.auditIds) {
    const row = await getRegenerationRow(input.db, auditId);
    if (row === null) throw new SeoAuditReportRegenerationError("not_found");
    const prepared = prepareRegeneration(row);
    const pdf = await renderPdf({
      businessName: prepared.row.businessName,
      websiteUrl: prepared.row.websiteUrl,
      createdAt: prepared.row.completedAt!,
      audit: prepared.stored.audit,
    });
    const reportSha256 = createHash("sha256").update(pdf).digest("hex");
    const report = await input.blobStorage.putReport({
      pathname: `growth-seo-audits/${auditId}/audit-${reportSha256}.pdf`,
      bytes: pdf,
    });

    let previousReportUrl: string;
    try {
      previousReportUrl = await persistRegeneratedReport(input.db, {
        prepared,
        reportUrl: report.url,
        reportSha256,
        correlationId: input.correlationId,
        now: input.now,
      });
    } catch (error) {
      await input.blobStorage.deleteReport(report.url).catch(() => undefined);
      throw error;
    }
    if (previousReportUrl !== report.url) {
      await input.blobStorage
        .deleteReport(previousReportUrl)
        .catch(() => undefined);
    }
  }

  return input.auditIds.length;
}
