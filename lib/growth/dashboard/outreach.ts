import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

const SEQUENCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LIST_ROWS = 50;

const TERMINAL_SEQUENCE_STATUSES = new Set([
  "stopped_reply",
  "stopped_opt_out",
  "stopped_bounce",
  "stopped_rejected",
  "stopped_started_talks",
  "completed",
]);

export type OutreachListRow = {
  sequenceId: string;
  prospectId: string;
  businessName: string;
  contactName: string;
  status: string;
  currentStep: number;
  lastActivityAt: string;
};

export type OutreachListResult =
  | { status: "ready"; rows: readonly OutreachListRow[] }
  | { status: "error"; message: string; correlationId: string };

export async function getOutreachList(
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<OutreachListResult> {
  try {
    const rows = await db<
      (Omit<OutreachListRow, "lastActivityAt"> & { lastActivityAt: Date })[]
    >`
      select
        se.id as "sequenceId",
        se.prospect_id as "prospectId",
        b.legal_name as "businessName",
        nullif(
          concat_ws(' ', nullif(trim(c.first_name), ''), nullif(trim(c.last_name), '')),
          ''
        ) as "contactName",
        se.status,
        se.current_step as "currentStep",
        coalesce(se.stopped_at, se.started_at, se.created_at) as "lastActivityAt"
      from growth.sequence_enrollments se
      inner join growth.prospects p on p.id = se.prospect_id
      inner join growth.businesses b on b.id = p.business_id
      inner join growth.contacts c on c.id = se.contact_id
      order by coalesce(se.stopped_at, se.started_at, se.created_at) desc
      limit ${MAX_LIST_ROWS}
    `;

    return {
      status: "ready",
      rows: rows.map((row) => ({
        ...row,
        contactName: row.contactName ?? "Unnamed contact",
        lastActivityAt: row.lastActivityAt.toISOString(),
      })),
    };
  } catch {
    return {
      status: "error",
      message: "The outreach list could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export type TimelineEventKind =
  | "scheduled"
  | "sent"
  | "reply"
  | "failed"
  | "cancelled"
  | "paused"
  | "resumed"
  | "stopped";

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  stepNumber: number | null;
  label: string;
  occurredAt: string;
  providerObservedAt: string | null;
  localReceivedAt: string | null;
  detail: string | null;
};

export type ThreadHealth = {
  deliveredCount: number;
  repliedCount: number;
  lastGmailSyncAt: string | null;
};

export type OutreachSequenceDetail = {
  sequenceId: string;
  prospectId: string;
  status: string;
  currentStep: number;
  stopReason: string | null;
  stoppedAt: string | null;
  startedAt: string | null;
  gmailThreadUrl: string | null;
  resumable: boolean;
  businessName: string;
  websiteUrl: string | null;
  contactName: string;
  contactEmail: string;
  fitScore: number;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
  timeline: readonly TimelineEvent[];
  threadHealth: ThreadHealth;
};

export type OutreachDetailResult =
  | { status: "ready"; data: OutreachSequenceDetail }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

type EnrollmentRow = {
  sequenceId: string;
  prospectId: string;
  status: string;
  currentStep: number;
  stopReason: string | null;
  stoppedAt: Date | null;
  startedAt: Date | null;
  gmailThreadId: string | null;
  businessName: string;
  websiteUrl: string | null;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  fitScore: number;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
};

async function fetchEnrollmentRow(
  db: GrowthQueryExecutor,
  sequenceId: string,
): Promise<EnrollmentRow | null> {
  const rows = await db<EnrollmentRow[]>`
    select
      se.id as "sequenceId",
      se.prospect_id as "prospectId",
      se.status,
      se.current_step as "currentStep",
      se.stop_reason as "stopReason",
      se.stopped_at as "stoppedAt",
      se.started_at as "startedAt",
      se.gmail_thread_id as "gmailThreadId",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl",
      c.first_name as "contactFirstName",
      c.last_name as "contactLastName",
      c.email as "contactEmail",
      p.fit_score as "fitScore",
      p.recommended_offer as "recommendedOffer",
      p.estimated_one_off_min_pence as "estimatedOneOffMinPence",
      p.estimated_one_off_max_pence as "estimatedOneOffMaxPence"
    from growth.sequence_enrollments se
    inner join growth.prospects p on p.id = se.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    inner join growth.contacts c on c.id = se.contact_id
    where se.id = ${sequenceId}
    limit 1
  `;
  return rows[0] ?? null;
}

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  stepNumber: number;
  status: string;
  scheduledFor: Date | null;
  sentAt: Date | null;
  receivedAt: Date | null;
  lastErrorSummary: string | null;
  updatedAt: Date;
  eventType: string | null;
  eventOccurredAt: Date | null;
  eventCreatedAt: Date | null;
};

async function fetchMessageRows(
  db: GrowthQueryExecutor,
  sequenceId: string,
): Promise<MessageRow[]> {
  return db<MessageRow[]>`
    select
      em.id,
      em.direction,
      em.step_number as "stepNumber",
      em.status,
      em.scheduled_for as "scheduledFor",
      em.sent_at as "sentAt",
      em.received_at as "receivedAt",
      em.last_error_summary as "lastErrorSummary",
      em.updated_at as "updatedAt",
      ev.event_type as "eventType",
      ev.occurred_at as "eventOccurredAt",
      ev.created_at as "eventCreatedAt"
    from growth.email_messages em
    left join growth.email_events ev on ev.email_message_id = em.id
    where em.sequence_enrollment_id = ${sequenceId}
    order by em.step_number asc, em.created_at asc
  `;
}

type AuditRow = { action: string; createdAt: Date };

async function fetchAuditRows(
  db: GrowthQueryExecutor,
  sequenceId: string,
): Promise<AuditRow[]> {
  return db<AuditRow[]>`
    select action, created_at as "createdAt"
    from growth.audit_log
    where entity_type = 'sequence_enrollment' and entity_id = ${sequenceId}
    order by created_at asc
  `;
}

async function fetchLastGmailSyncAt(
  db: GrowthQueryExecutor,
): Promise<string | null> {
  const rows = await db<{ lastSyncedAt: Date | null }[]>`
    select last_synced_at as "lastSyncedAt"
    from growth.integration_connections
    where provider = 'gmail'
    order by last_synced_at desc nulls last
    limit 1
  `;
  const value = rows[0]?.lastSyncedAt;
  return value ? value.toISOString() : null;
}

const OUTBOUND_STEP_LABELS = [
  "First email",
  "Short follow-up",
  "Useful example",
  "Close the loop",
];

function outboundLabel(stepNumber: number): string {
  return OUTBOUND_STEP_LABELS[stepNumber] ?? `Step ${stepNumber}`;
}

const AUDIT_ACTION_EVENTS: Record<
  string,
  { kind: TimelineEventKind; label: string }
> = {
  "sequence.stopped.pause": { kind: "paused", label: "Paused by founder" },
  "sequence.stopped.started_talks": {
    kind: "stopped",
    label: "Marked as started talks",
  },
  "sequence.stopped.rejected": { kind: "stopped", label: "Rejected by founder" },
  "sequence.stopped.do_not_contact": {
    kind: "stopped",
    label: "Marked do not contact",
  },
  "sequence.resumed": { kind: "resumed", label: "Resumed by founder" },
};

function messageRowToEvent(row: MessageRow): TimelineEvent | null {
  if (row.direction === "inbound") {
    const kind: TimelineEventKind = row.eventType === "reply" ? "reply" : "stopped";
    const occurredAt = row.eventOccurredAt ?? row.receivedAt;
    if (!occurredAt) return null;
    return {
      id: row.id,
      kind,
      stepNumber: null,
      label:
        row.eventType === "bounce"
          ? "Delivery bounced"
          : row.eventType === "auto_response"
            ? "Automated response received"
            : "Reply detected",
      occurredAt: occurredAt.toISOString(),
      providerObservedAt: row.eventOccurredAt?.toISOString() ?? null,
      localReceivedAt: row.eventCreatedAt?.toISOString() ?? null,
      detail: null,
    };
  }

  if (row.status === "sent" && row.sentAt) {
    return {
      id: row.id,
      kind: "sent",
      stepNumber: row.stepNumber,
      label: outboundLabel(row.stepNumber),
      occurredAt: row.sentAt.toISOString(),
      providerObservedAt: row.sentAt.toISOString(),
      localReceivedAt: null,
      detail: "Sent",
    };
  }

  if ((row.status === "queued" || row.status === "retry") && row.scheduledFor) {
    return {
      id: row.id,
      kind: "scheduled",
      stepNumber: row.stepNumber,
      label: outboundLabel(row.stepNumber),
      occurredAt: row.scheduledFor.toISOString(),
      providerObservedAt: null,
      localReceivedAt: null,
      detail: "Scheduled",
    };
  }

  if (row.status === "failed") {
    return {
      id: row.id,
      kind: "failed",
      stepNumber: row.stepNumber,
      label: outboundLabel(row.stepNumber),
      occurredAt: row.updatedAt.toISOString(),
      providerObservedAt: null,
      localReceivedAt: null,
      detail: row.lastErrorSummary,
    };
  }

  if (row.status === "cancelled") {
    return {
      id: row.id,
      kind: "cancelled",
      stepNumber: row.stepNumber,
      label: outboundLabel(row.stepNumber),
      occurredAt: row.updatedAt.toISOString(),
      providerObservedAt: null,
      localReceivedAt: null,
      detail: "Cancelled because the sequence stopped",
    };
  }

  return null;
}

const KIND_ORDER: Record<TimelineEventKind, number> = {
  scheduled: 0,
  sent: 1,
  reply: 2,
  failed: 3,
  cancelled: 4,
  paused: 5,
  resumed: 6,
  stopped: 7,
};

function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  if (a.occurredAt !== b.occurredAt) {
    return a.occurredAt < b.occurredAt ? -1 : 1;
  }
  if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) {
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildTimeline(
  messageRows: readonly MessageRow[],
  auditRows: readonly AuditRow[],
): TimelineEvent[] {
  const messageEvents = messageRows
    .map(messageRowToEvent)
    .filter((event): event is TimelineEvent => event !== null);

  const auditEvents = auditRows.flatMap((row) => {
    const mapped = AUDIT_ACTION_EVENTS[row.action];
    if (!mapped) return [];
    return [
      {
        id: `audit:${row.action}:${row.createdAt.toISOString()}`,
        kind: mapped.kind,
        stepNumber: null,
        label: mapped.label,
        occurredAt: row.createdAt.toISOString(),
        providerObservedAt: null,
        localReceivedAt: row.createdAt.toISOString(),
        detail: null,
      } satisfies TimelineEvent,
    ];
  });

  return [...messageEvents, ...auditEvents].sort(compareEvents);
}

function buildGmailThreadUrl(threadId: string | null): string | null {
  if (!threadId) return null;
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`;
}

export async function getOutreachDetail(
  sequenceId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<OutreachDetailResult> {
  if (!SEQUENCE_ID_PATTERN.test(sequenceId)) {
    return { status: "not_found" };
  }

  try {
    const enrollment = await fetchEnrollmentRow(db, sequenceId);
    if (!enrollment) return { status: "not_found" };

    const [messageRows, auditRows, lastGmailSyncAt] = await Promise.all([
      fetchMessageRows(db, sequenceId),
      fetchAuditRows(db, sequenceId),
      fetchLastGmailSyncAt(db),
    ]);

    const timeline = buildTimeline(messageRows, auditRows);
    const deliveredCount = messageRows.filter(
      (row) => row.direction === "outbound" && row.status === "sent",
    ).length;
    const repliedCount = messageRows.filter(
      (row) => row.direction === "inbound" && row.eventType === "reply",
    ).length;

    return {
      status: "ready",
      data: {
        sequenceId: enrollment.sequenceId,
        prospectId: enrollment.prospectId,
        status: enrollment.status,
        currentStep: enrollment.currentStep,
        stopReason: enrollment.stopReason,
        stoppedAt: enrollment.stoppedAt?.toISOString() ?? null,
        startedAt: enrollment.startedAt?.toISOString() ?? null,
        gmailThreadUrl: buildGmailThreadUrl(enrollment.gmailThreadId),
        resumable: enrollment.status === "paused",
        businessName: enrollment.businessName,
        websiteUrl: enrollment.websiteUrl,
        contactName: `${enrollment.contactFirstName} ${enrollment.contactLastName}`,
        contactEmail: enrollment.contactEmail,
        fitScore: enrollment.fitScore,
        recommendedOffer: enrollment.recommendedOffer,
        estimatedOneOffMinPence: enrollment.estimatedOneOffMinPence,
        estimatedOneOffMaxPence: enrollment.estimatedOneOffMaxPence,
        timeline,
        threadHealth: { deliveredCount, repliedCount, lastGmailSyncAt },
      },
    };
  } catch {
    return {
      status: "error",
      message: "The outreach sequence could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export function isReversibleSequenceStatus(status: string): boolean {
  return status === "paused";
}

export function isTerminalSequenceStatus(status: string): boolean {
  return TERMINAL_SEQUENCE_STATUSES.has(status);
}
