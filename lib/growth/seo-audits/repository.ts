import { randomUUID } from "node:crypto";

import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthQueryExecutor } from "../db/types";
import { scheduleFollowUp } from "../sequences/schedule";

import { parseStoredSeoAuditDraft, type StoredSeoAuditDraft } from "./schema";

const CLAIM_DURATION_MS = 2 * 60 * 60 * 1_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SeoAuditCandidate = {
  auditId: string;
  sequenceEnrollmentId: string;
  businessName: string;
  websiteUrl: string;
  sector: string;
  locality: string;
  contactFirstName: string;
};

type CandidateRow = SeoAuditCandidate;

function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new TypeError("SEO audit claim limit is invalid.");
  }
}

/**
 * Claims a small batch of eligible sequences for the external audit agent.
 * The application performs the database query so the agent never receives a
 * database credential or an unbounded list of prospect data.
 */
export async function claimSeoAuditCandidates(
  db: GrowthDb,
  limit: number,
  now: Date,
): Promise<SeoAuditCandidate[]> {
  validateLimit(limit);
  const claimExpiresAt = new Date(now.getTime() + CLAIM_DURATION_MS);

  return withGrowthTransaction(db, async (transaction) => {
    const rows = await transaction<CandidateRow[]>`
      with eligible as (
        select
          se.id as "sequenceEnrollmentId",
          p.id as "prospectId",
          b.legal_name as "businessName",
          b.website_url as "websiteUrl",
          b.sector,
          b.locality,
          c.first_name as "contactFirstName"
        from growth.sequence_enrollments se
        inner join growth.prospects p on p.id = se.prospect_id
        inner join growth.businesses b on b.id = p.business_id
        inner join growth.contacts c on c.id = se.contact_id
        left join growth.seo_audit_drafts audit
          on audit.sequence_enrollment_id = se.id
        where se.status = 'active'
          and nullif(trim(b.website_url), '') is not null
          and exists (
            select 1
            from growth.email_messages day_5_follow_up
            where day_5_follow_up.sequence_enrollment_id = se.id
              and day_5_follow_up.direction = 'outbound'
              and day_5_follow_up.step_number = 1
              and day_5_follow_up.status = 'sent'
          )
          and not exists (
            select 1
            from growth.email_messages inbound
            where inbound.sequence_enrollment_id = se.id
              and inbound.direction = 'inbound'
              and inbound.status = 'received'
          )
          and (
            audit.id is null
            or (
              audit.status = 'claimed'
              and audit.claim_expires_at < ${now}
            )
          )
        order by se.updated_at asc
        limit ${limit}
        for update of se, p, b, c skip locked
      ),
      claimed as (
        insert into growth.seo_audit_drafts (
          sequence_enrollment_id,
          prospect_id,
          status,
          claim_expires_at
        )
        select
          eligible."sequenceEnrollmentId",
          eligible."prospectId",
          'claimed',
          ${claimExpiresAt}
        from eligible
        on conflict (sequence_enrollment_id) do update
          set status = 'claimed',
              claim_expires_at = excluded.claim_expires_at,
              updated_at = now()
          where growth.seo_audit_drafts.status = 'claimed'
            and growth.seo_audit_drafts.claim_expires_at < ${now}
        returning id, sequence_enrollment_id as "sequenceEnrollmentId"
      )
      select
        claimed.id as "auditId",
        eligible."sequenceEnrollmentId",
        eligible."businessName",
        eligible."websiteUrl",
        eligible.sector,
        eligible.locality,
        eligible."contactFirstName"
      from claimed
      inner join eligible
        on eligible."sequenceEnrollmentId" = claimed."sequenceEnrollmentId"
    `;
    return rows;
  });
}

export type CompleteSeoAuditDraftInput = {
  auditId: string;
  outputSnapshot: StoredSeoAuditDraft;
};

export async function releaseSeoAuditClaims(
  db: GrowthDb,
  input: { auditIds: readonly string[]; correlationId: string },
  now: Date,
): Promise<number> {
  if (input.auditIds.length === 0 || input.auditIds.length > 5) {
    throw new TypeError("SEO audit claim release count is invalid.");
  }
  if (!input.auditIds.every((auditId) => UUID_PATTERN.test(auditId))) {
    throw new TypeError("SEO audit claim release ID is invalid.");
  }

  return withGrowthTransaction(db, async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      update growth.seo_audit_drafts
      set claim_expires_at = ${now},
          updated_at = ${now}
      where id = any(${input.auditIds}::uuid[])
        and status = 'claimed'
      returning id
    `;

    await Promise.all(
      rows.map((row) =>
        appendAuditEvent(transaction, {
          correlationId: input.correlationId,
          actorType: "agent",
          actorId: "seo-audit-agent-v1",
          action: "seo_audit.claim_released",
          entityType: "seo_audit_draft",
          entityId: row.id,
          metadata: { reasonCode: "agent_run_incomplete" },
        }),
      ),
    );

    return rows.length;
  });
}

export type SeoAuditDraftRenderContext = {
  auditId: string;
  status: string;
  claimExpiresAt: Date | null;
  businessName: string;
  websiteUrl: string;
};

export async function getSeoAuditDraftRenderContext(
  db: GrowthQueryExecutor,
  auditId: string,
): Promise<SeoAuditDraftRenderContext | null> {
  if (!UUID_PATTERN.test(auditId)) return null;
  const rows = await db<SeoAuditDraftRenderContext[]>`
    select
      audit.id as "auditId",
      audit.status,
      audit.claim_expires_at as "claimExpiresAt",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl"
    from growth.seo_audit_drafts audit
    inner join growth.prospects p on p.id = audit.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    where audit.id = ${auditId}
      and nullif(trim(b.website_url), '') is not null
    limit 1
  `;
  return rows[0] ?? null;
}

export type SeoAuditDraftCompletionErrorCode =
  | "not_found"
  | "claim_expired"
  | "not_eligible";

export class SeoAuditDraftCompletionError extends Error {
  constructor(readonly code: SeoAuditDraftCompletionErrorCode) {
    super("The SEO audit draft could not be saved.");
    this.name = "SeoAuditDraftCompletionError";
  }
}

type SeoAuditDraftPersistencePhase =
  | "lock_draft"
  | "save_draft"
  | "append_audit_event";

export class SeoAuditDraftPersistenceError extends Error {
  constructor(readonly phase: SeoAuditDraftPersistencePhase) {
    super("The SEO audit draft could not be persisted.");
    this.name = `SeoAuditDraftPersistence${phase
      .split("_")
      .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
      .join("")}Error`;
  }
}

type CompletionRow = {
  id: string;
  status: string;
  claimExpiresAt: Date | null;
  sequenceStatus: string;
  day5FollowUpSent: boolean;
  hasInboundReply: boolean;
};

export async function completeSeoAuditDraft(
  db: GrowthDb,
  input: CompleteSeoAuditDraftInput,
  now: Date,
): Promise<void> {
  if (!UUID_PATTERN.test(input.auditId)) {
    throw new TypeError("SEO audit draft ID is invalid.");
  }
  const stored: StoredSeoAuditDraft = input.outputSnapshot;

  let phase: SeoAuditDraftPersistencePhase = "lock_draft";
  try {
    await withGrowthTransaction(db, async (transaction) => {
      const rows = await transaction<CompletionRow[]>`
      select
        audit.id,
        audit.status,
        audit.claim_expires_at as "claimExpiresAt",
        se.status as "sequenceStatus",
        exists (
          select 1
          from growth.email_messages day_5_follow_up
          where day_5_follow_up.sequence_enrollment_id = se.id
            and day_5_follow_up.direction = 'outbound'
            and day_5_follow_up.step_number = 1
            and day_5_follow_up.status = 'sent'
        ) as "day5FollowUpSent",
        exists (
          select 1
          from growth.email_messages inbound
          where inbound.sequence_enrollment_id = se.id
            and inbound.direction = 'inbound'
            and inbound.status = 'received'
        ) as "hasInboundReply"
      from growth.seo_audit_drafts audit
      inner join growth.sequence_enrollments se
        on se.id = audit.sequence_enrollment_id
      where audit.id = ${input.auditId}
      limit 1
      for update of audit, se
    `;
      const draft = rows[0];
      if (!draft) throw new SeoAuditDraftCompletionError("not_found");
      if (
        draft.status !== "claimed" ||
        draft.claimExpiresAt === null ||
        draft.claimExpiresAt < now
      ) {
        throw new SeoAuditDraftCompletionError("claim_expired");
      }
      if (
        draft.sequenceStatus !== "active" ||
        !draft.day5FollowUpSent ||
        draft.hasInboundReply
      ) {
        throw new SeoAuditDraftCompletionError("not_eligible");
      }

      phase = "save_draft";
      await transaction`
      update growth.seo_audit_drafts
      set status = 'draft',
          claim_expires_at = null,
          output_snapshot = ${transaction.json(stored)},
          report_url = ${stored.reportUrl},
          report_sha256 = ${stored.reportSha256},
          completed_at = ${now},
          updated_at = ${now}
      where id = ${input.auditId}
        and status = 'claimed'
    `;
      phase = "append_audit_event";
      await appendAuditEvent(transaction, {
        correlationId: input.auditId,
        actorType: "agent",
        actorId: "seo-audit-agent-v1",
        action: "seo_audit.draft_created",
        entityType: "seo_audit_draft",
        entityId: input.auditId,
        metadata: { reasonCode: "after_day_5_follow_up" },
      });
    });
  } catch (error) {
    if (
      error instanceof SeoAuditDraftCompletionError ||
      error instanceof SeoAuditDraftPersistenceError
    ) {
      throw error;
    }
    throw new SeoAuditDraftPersistenceError(phase);
  }
}

export type SeoAuditApprovalErrorCode =
  | "not_found"
  | "not_approvable"
  | "version_conflict"
  | "suppressed_contact"
  | "non_corporate_contact"
  | "reply_detected"
  | "invalid_stored_draft";

export class SeoAuditApprovalError extends Error {
  constructor(readonly code: SeoAuditApprovalErrorCode) {
    super("The SEO audit email could not be approved.");
    this.name = "SeoAuditApprovalError";
  }
}

export type ApproveSeoAuditDraftInput = {
  auditId: string;
  expectedVersion: number;
  founderActorId: string;
  correlationId: string;
};

export type ApprovedSeoAuditMessage = {
  auditId: string;
  messageId: string;
  scheduledFor: string;
};

type ApprovalRow = {
  id: string;
  version: number;
  status: string;
  outputSnapshot: unknown;
  sequenceEnrollmentId: string;
  prospectId: string;
  contactId: string;
  sequenceStatus: string;
  firstSentAt: Date | null;
  normalisedEmail: string;
  subscriberType: string;
  corporateStatus: string;
};

function validateApprovalInput(input: ApproveSeoAuditDraftInput): void {
  if (
    !UUID_PATTERN.test(input.auditId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !/^[0-9a-f]{64}$/.test(input.founderActorId) ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200
  ) {
    throw new TypeError("SEO audit approval request is invalid.");
  }
}

export async function approveSeoAuditDraft(
  db: GrowthDb,
  input: ApproveSeoAuditDraftInput,
  now: Date,
  createMessageId: () => string = randomUUID,
): Promise<ApprovedSeoAuditMessage> {
  validateApprovalInput(input);

  return withGrowthTransaction(db, async (transaction) => {
    const rows = await transaction<ApprovalRow[]>`
      select
        audit.id,
        audit.version,
        audit.status,
        audit.output_snapshot as "outputSnapshot",
        se.id as "sequenceEnrollmentId",
        se.prospect_id as "prospectId",
        se.contact_id as "contactId",
        se.status as "sequenceStatus",
        first_message.sent_at as "firstSentAt",
        c.normalised_email as "normalisedEmail",
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
      where audit.id = ${input.auditId}
      limit 1
      for update of audit, se
    `;
    const draft = rows[0];
    if (!draft) throw new SeoAuditApprovalError("not_found");
    if (draft.status !== "draft") {
      throw new SeoAuditApprovalError("not_approvable");
    }
    if (draft.version !== input.expectedVersion) {
      throw new SeoAuditApprovalError("version_conflict");
    }
    if (draft.sequenceStatus !== "active" || draft.firstSentAt === null) {
      throw new SeoAuditApprovalError("not_approvable");
    }
    if (
      draft.subscriberType !== "corporate" ||
      draft.corporateStatus !== "active"
    ) {
      throw new SeoAuditApprovalError("non_corporate_contact");
    }

    const suppressed = await transaction<{ exists: boolean }[]>`
      select exists(
        select 1 from growth.suppressions
        where normalised_email = ${draft.normalisedEmail}
      ) as exists
    `;
    if (suppressed[0]?.exists) {
      throw new SeoAuditApprovalError("suppressed_contact");
    }
    const replies = await transaction<{ exists: boolean }[]>`
      select exists(
        select 1 from growth.email_messages
        where sequence_enrollment_id = ${draft.sequenceEnrollmentId}
          and direction = 'inbound'
          and status = 'received'
      ) as exists
    `;
    if (replies[0]?.exists) {
      throw new SeoAuditApprovalError("reply_detected");
    }

    let stored: StoredSeoAuditDraft;
    try {
      stored = parseStoredSeoAuditDraft(draft.outputSnapshot);
    } catch {
      throw new SeoAuditApprovalError("invalid_stored_draft");
    }
    if (stored.reviewState !== "draft" || stored.version !== draft.version) {
      throw new SeoAuditApprovalError("invalid_stored_draft");
    }

    const messageId = createMessageId();
    if (!UUID_PATTERN.test(messageId)) {
      throw new Error(
        "SEO audit message ID generator returned an invalid UUID.",
      );
    }
    const scheduledFor = scheduleFollowUp(draft.firstSentAt, "day_11");
    await transaction`
      insert into growth.email_messages (
        id,
        sequence_enrollment_id,
        prospect_id,
        contact_id,
        channel,
        direction,
        step_number,
        status,
        subject_snapshot,
        html_snapshot,
        text_snapshot,
        idempotency_key,
        scheduled_for
      ) values (
        ${messageId},
        ${draft.sequenceEnrollmentId},
        ${draft.prospectId},
        ${draft.contactId},
        'gmail',
        'outbound',
        2,
        'queued',
        ${stored.email.subject},
        ${stored.email.html},
        ${stored.email.text},
        ${`seo_audit_follow_up:${draft.id}`},
        ${scheduledFor}
      )
    `;
    const approvedSnapshot: StoredSeoAuditDraft = {
      ...stored,
      reviewState: "approved",
    };
    await transaction`
      update growth.seo_audit_drafts
      set status = 'approved',
          output_snapshot = ${transaction.json(approvedSnapshot)},
          approved_at = ${now},
          updated_at = ${now}
      where id = ${draft.id}
        and status = 'draft'
        and version = ${input.expectedVersion}
    `;
    await appendAuditEvent(transaction, {
      correlationId: input.correlationId,
      actorType: "founder",
      actorId: input.founderActorId,
      action: "seo_audit.email_approved",
      entityType: "seo_audit_draft",
      entityId: draft.id,
      metadata: { approved: true, reasonCode: "founder_review" },
    });

    return {
      auditId: draft.id,
      messageId,
      scheduledFor: scheduledFor.toISOString(),
    };
  });
}

export type SeoAuditListRow = {
  auditId: string;
  businessName: string;
  websiteUrl: string;
  completedAt: string;
  version: number;
};

export async function listSeoAuditDrafts(
  db: GrowthQueryExecutor,
): Promise<SeoAuditListRow[]> {
  const rows = await db<
    (Omit<SeoAuditListRow, "completedAt"> & { completedAt: Date })[]
  >`
    select
      audit.id as "auditId",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl",
      audit.completed_at as "completedAt",
      audit.version
    from growth.seo_audit_drafts audit
    inner join growth.prospects p on p.id = audit.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    where audit.status = 'draft'
    order by audit.completed_at asc
    limit 50
  `;
  return rows.map((row) => ({
    ...row,
    completedAt: row.completedAt.toISOString(),
  }));
}
