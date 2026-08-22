import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import type { DeliveryStatus } from "../pipeline/stages";
import type { ViewState } from "./view-models";

const PAGE_SIZE = 20;
const MAX_HISTORY_ENTRIES = 100;
const BUSINESS_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_ID_PATTERN = BUSINESS_ID_PATTERN;

// A delivery that has run its course either way (reached support, or
// stopped) no longer counts as "active" for the client list filter - only
// the still-in-flight statuses do. Written as a literal SQL fragment
// (fixed, not user input) rather than a bound array, since an enum column
// does not implicitly cast against a bound text[] parameter.
const ACTIVE_DELIVERY_STATUS_SQL =
  "de.delivery_status in ('not_started', 'discovery', 'build', 'review')";

export const CLIENT_STATUS_FILTER_VALUES = ["all", "active", "completed"] as const;
export type ClientStatusFilter = (typeof CLIENT_STATUS_FILTER_VALUES)[number];

export type ClientListQuery = {
  status: ClientStatusFilter;
  after: string | null;
};

type RawSearchParams = Record<string, string | readonly string[] | undefined>;

function firstValue(
  value: string | readonly string[] | undefined,
): string | undefined {
  return Array.isArray(value)
    ? (value[0] as string | undefined)
    : (value as string | undefined);
}

function parseEnumParam<const T extends readonly string[]>(
  values: T,
  raw: string | undefined,
): T[number] {
  return (values as readonly string[]).includes(raw ?? "")
    ? (raw as T[number])
    : (values[0] as T[number]);
}

export function parseClientListQuery(searchParams: RawSearchParams): ClientListQuery {
  const after = (firstValue(searchParams.after) ?? "").trim();
  return {
    status: parseEnumParam(CLIENT_STATUS_FILTER_VALUES, firstValue(searchParams.status)),
    after: after.length > 0 && after.length <= 400 ? after : null,
  };
}

export type ClientListRow = {
  businessId: string;
  businessName: string;
  sector: string;
  locality: string;
  primaryContactName: string | null;
  engagementCount: number;
  latestDeliveryStatus: DeliveryStatus;
  lifetimeValuePence: number;
  lastActivityAt: string;
  nextAction: string | null;
  nextActionDueAt: string | null;
};

export type ClientListResult = {
  rows: readonly ClientListRow[];
  totalCount: number;
  nextCursor: string | null;
};

type ClientCursor = { lastActivityAt: string; businessId: string };

export function encodeClientCursor(row: ClientListRow): string {
  const cursor: ClientCursor = {
    lastActivityAt: row.lastActivityAt,
    businessId: row.businessId,
  };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeClientCursor(value: string): ClientCursor | null {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof (decoded as ClientCursor).lastActivityAt === "string" &&
      typeof (decoded as ClientCursor).businessId === "string"
    ) {
      return decoded as ClientCursor;
    }
    return null;
  } catch {
    return null;
  }
}

function statusFragment(db: GrowthQueryExecutor, status: ClientStatusFilter) {
  if (status === "active") return db`and agg.has_active`;
  if (status === "completed") return db`and not agg.has_active`;
  return db``;
}

type ListDbRow = Omit<ClientListRow, "lastActivityAt"> & { lastActivityAt: Date };

async function fetchClientRows(
  db: GrowthQueryExecutor,
  query: ClientListQuery,
): Promise<{ rows: ClientListRow[]; nextCursor: string | null }> {
  const cursor = query.after ? decodeClientCursor(query.after) : null;
  const cursorFragment = cursor
    ? db`and (
        agg.last_activity_at < ${cursor.lastActivityAt}::timestamptz
        or (agg.last_activity_at = ${cursor.lastActivityAt}::timestamptz and b.id > ${cursor.businessId})
      )`
    : db``;

  const rows = await db<ListDbRow[]>`
    select
      b.id as "businessId",
      b.legal_name as "businessName",
      b.sector,
      b.locality,
      case
        when c.first_name is null then null
        else c.first_name || ' ' || c.last_name
      end as "primaryContactName",
      agg.engagement_count as "engagementCount",
      agg.lifetime_value_pence as "lifetimeValuePence",
      agg.last_activity_at as "lastActivityAt",
      latest.delivery_status as "latestDeliveryStatus",
      latest.next_action as "nextAction",
      latest.next_action_due_at as "nextActionDueAt"
    from growth.businesses b
    inner join lateral (
      select
        count(*)::int as engagement_count,
        (sum(coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0)))::int as lifetime_value_pence,
        max(de.updated_at) as last_activity_at,
        bool_or(${db.unsafe(ACTIVE_DELIVERY_STATUS_SQL)}) as has_active
      from growth.delivery_engagements de
      inner join growth.prospects p on p.id = de.prospect_id
      where p.business_id = b.id and de.stage = 'won'
    ) agg on true
    inner join lateral (
      select de.delivery_status, p.next_action, p.next_action_due_at, p.primary_contact_id
      from growth.delivery_engagements de
      inner join growth.prospects p on p.id = de.prospect_id
      where p.business_id = b.id and de.stage = 'won'
      order by de.updated_at desc, de.id desc
      limit 1
    ) latest on true
    left join growth.contacts c on c.id = latest.primary_contact_id
    where agg.engagement_count > 0
      ${statusFragment(db, query.status)}
      ${cursorFragment}
    order by agg.last_activity_at desc, b.id asc
    limit ${PAGE_SIZE + 1}
  `;

  const hasNextPage = rows.length > PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
  const shaped = page.map((row) => ({
    ...row,
    lastActivityAt: row.lastActivityAt.toISOString(),
  }));
  const last = shaped.at(-1);

  return {
    rows: shaped,
    nextCursor: hasNextPage && last ? encodeClientCursor(last) : null,
  };
}

async function fetchClientTotalCount(
  db: GrowthQueryExecutor,
  query: ClientListQuery,
): Promise<number> {
  const rows = await db<{ count: number }[]>`
    select count(*)::int as count
    from growth.businesses b
    inner join lateral (
      select
        count(*)::int as engagement_count,
        bool_or(${db.unsafe(ACTIVE_DELIVERY_STATUS_SQL)}) as has_active
      from growth.delivery_engagements de
      inner join growth.prospects p on p.id = de.prospect_id
      where p.business_id = b.id and de.stage = 'won'
    ) agg on true
    where agg.engagement_count > 0
      ${statusFragment(db, query.status)}
  `;
  return rows[0]?.count ?? 0;
}

export async function getClientListResult(
  query: ClientListQuery,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ViewState<ClientListResult>> {
  try {
    const [{ rows, nextCursor }, totalCount] = await Promise.all([
      fetchClientRows(db, query),
      fetchClientTotalCount(db, query),
    ]);
    return { status: "ready", data: { rows, totalCount, nextCursor } };
  } catch {
    return {
      status: "error",
      message: "The client list could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export type ClientDetailBusiness = {
  legalName: string;
  tradingName: string | null;
  sector: string;
  locality: string;
  websiteUrl: string | null;
};

export type ClientDeliveryHistoryEntry = {
  id: string;
  fromState: string;
  toState: string;
  reasonCode: string | null;
  occurredAt: string;
};

export type ClientEngagementMessage = {
  messageId: string;
  status: "pending_approval" | "sent";
};

export type ClientEngagementSummary = {
  engagementId: string;
  version: number;
  name: string;
  deliveryStatus: DeliveryStatus;
  oneOffValuePence: number | null;
  monthlyValuePence: number | null;
  wonAt: string | null;
  deliveryStartDate: string | null;
  deliveryTargetDate: string | null;
  newsletterInvitedAt: string | null;
  contact: {
    firstName: string;
    lastName: string;
    roleTitle: string | null;
    email: string;
  } | null;
  deliveryHistory: readonly ClientDeliveryHistoryEntry[];
  thankYouMessage: ClientEngagementMessage | null;
};

export type ClientDetail = {
  businessId: string;
  business: ClientDetailBusiness;
  engagements: readonly ClientEngagementSummary[];
};

export type ClientDetailResult =
  | { status: "found"; data: ClientDetail }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

type EngagementRow = {
  engagementId: string;
  version: number;
  name: string;
  deliveryStatus: DeliveryStatus;
  oneOffValuePence: number | null;
  monthlyValuePence: number | null;
  wonAt: Date | null;
  deliveryStartDate: Date | null;
  deliveryTargetDate: Date | null;
  newsletterInvitedAt: Date | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactRoleTitle: string | null;
  contactEmail: string | null;
  messageId: string | null;
  messageStatus: "pending_approval" | "sent" | null;
};

async function fetchBusiness(
  db: GrowthQueryExecutor,
  businessId: string,
): Promise<ClientDetailBusiness | null> {
  const rows = await db<ClientDetailBusiness[]>`
    select
      legal_name as "legalName",
      trading_name as "tradingName",
      sector,
      locality,
      website_url as "websiteUrl"
    from growth.businesses
    where id = ${businessId}
  `;
  return rows[0] ?? null;
}

async function fetchWonEngagements(
  db: GrowthQueryExecutor,
  businessId: string,
): Promise<EngagementRow[]> {
  return db<EngagementRow[]>`
    select
      de.id as "engagementId",
      de.version,
      de.name,
      de.delivery_status as "deliveryStatus",
      de.one_off_value_pence as "oneOffValuePence",
      de.monthly_value_pence as "monthlyValuePence",
      de.won_at as "wonAt",
      de.delivery_start_date as "deliveryStartDate",
      de.delivery_target_date as "deliveryTargetDate",
      de.newsletter_invited_at as "newsletterInvitedAt",
      c.first_name as "contactFirstName",
      c.last_name as "contactLastName",
      c.role_title as "contactRoleTitle",
      c.email as "contactEmail",
      cm.id as "messageId",
      cm.status as "messageStatus"
    from growth.delivery_engagements de
    inner join growth.prospects p on p.id = de.prospect_id
    left join growth.contacts c on c.id = p.primary_contact_id
    left join growth.client_messages cm on cm.engagement_id = de.id
    where p.business_id = ${businessId} and de.stage = 'won'
    order by de.won_at desc, de.id asc
  `;
}

async function fetchDeliveryHistory(
  db: GrowthQueryExecutor,
  engagementId: string,
): Promise<ClientDeliveryHistoryEntry[]> {
  const rows = await db<
    (Omit<ClientDeliveryHistoryEntry, "occurredAt"> & { occurredAt: Date })[]
  >`
    select id, from_state as "fromState", to_state as "toState", reason_code as "reasonCode",
           occurred_at as "occurredAt"
    from growth.commercial_stage_events
    where engagement_id = ${engagementId} and dimension = 'delivery'
    order by occurred_at desc
    limit ${MAX_HISTORY_ENTRIES}
  `;
  return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
}

function toEngagementSummary(
  row: EngagementRow,
  deliveryHistory: readonly ClientDeliveryHistoryEntry[],
): ClientEngagementSummary {
  const contact =
    row.contactEmail && row.contactFirstName && row.contactLastName
      ? {
          firstName: row.contactFirstName,
          lastName: row.contactLastName,
          roleTitle: row.contactRoleTitle,
          email: row.contactEmail,
        }
      : null;

  const thankYouMessage =
    row.messageId && row.messageStatus
      ? { messageId: row.messageId, status: row.messageStatus }
      : null;

  return {
    engagementId: row.engagementId,
    version: row.version,
    name: row.name,
    deliveryStatus: row.deliveryStatus,
    oneOffValuePence: row.oneOffValuePence,
    monthlyValuePence: row.monthlyValuePence,
    wonAt: row.wonAt ? row.wonAt.toISOString() : null,
    deliveryStartDate: row.deliveryStartDate
      ? row.deliveryStartDate.toISOString().slice(0, 10)
      : null,
    deliveryTargetDate: row.deliveryTargetDate
      ? row.deliveryTargetDate.toISOString().slice(0, 10)
      : null,
    newsletterInvitedAt: row.newsletterInvitedAt
      ? row.newsletterInvitedAt.toISOString()
      : null,
    contact,
    deliveryHistory,
    thankYouMessage,
  };
}

export async function getClientDetail(
  businessId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ClientDetailResult> {
  if (!BUSINESS_ID_PATTERN.test(businessId)) {
    return { status: "not_found" };
  }

  try {
    const business = await fetchBusiness(db, businessId);
    if (!business) return { status: "not_found" };

    const engagementRows = await fetchWonEngagements(db, businessId);
    if (engagementRows.length === 0) return { status: "not_found" };

    const engagements = await Promise.all(
      engagementRows.map(async (row) =>
        toEngagementSummary(row, await fetchDeliveryHistory(db, row.engagementId)),
      ),
    );

    return {
      status: "found",
      data: { businessId, business, engagements },
    };
  } catch {
    return {
      status: "error",
      message: "The client record could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export type ClientThankYouReviewData = {
  messageId: string;
  engagementId: string;
  businessId: string;
  businessName: string;
  engagementName: string;
  version: number;
  status: "pending_approval" | "sent";
  includedNewsletterInvite: boolean;
  subject: string;
  previewHtml: string;
  previewText: string;
  recipientName: string;
  recipientEmail: string;
  testSentAt: string | null;
  founderEmail: string;
};

export type ClientThankYouReviewResult =
  | { status: "ready"; data: ClientThankYouReviewData }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string; correlationId: string };

type ReviewRow = {
  messageId: string;
  engagementId: string;
  businessId: string;
  businessName: string;
  engagementName: string;
  version: number;
  status: "pending_approval" | "sent";
  includedNewsletterInvite: boolean;
  subjectSnapshot: string;
  htmlSnapshot: string;
  textSnapshot: string;
  testSentAt: Date | null;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
};

export async function getClientThankYouReview(
  messageId: string,
  founderEmail: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ClientThankYouReviewResult> {
  if (!MESSAGE_ID_PATTERN.test(messageId)) {
    return { status: "unavailable", reason: "This message could not be found." };
  }

  try {
    const rows = await db<ReviewRow[]>`
      select
        cm.id as "messageId",
        cm.engagement_id as "engagementId",
        b.id as "businessId",
        b.legal_name as "businessName",
        de.name as "engagementName",
        cm.version,
        cm.status,
        cm.included_newsletter_invite as "includedNewsletterInvite",
        cm.subject_snapshot as "subjectSnapshot",
        cm.html_snapshot as "htmlSnapshot",
        cm.text_snapshot as "textSnapshot",
        cm.test_sent_at as "testSentAt",
        c.first_name as "contactFirstName",
        c.last_name as "contactLastName",
        c.email as "contactEmail"
      from growth.client_messages cm
      inner join growth.delivery_engagements de on de.id = cm.engagement_id
      inner join growth.prospects p on p.id = de.prospect_id
      inner join growth.businesses b on b.id = p.business_id
      inner join growth.contacts c on c.id = cm.recipient_contact_id
      where cm.id = ${messageId}
      limit 1
    `;

    const row = rows[0];
    if (!row) {
      return { status: "unavailable", reason: "This message could not be found." };
    }

    return {
      status: "ready",
      data: {
        messageId: row.messageId,
        engagementId: row.engagementId,
        businessId: row.businessId,
        businessName: row.businessName,
        engagementName: row.engagementName,
        version: row.version,
        status: row.status,
        includedNewsletterInvite: row.includedNewsletterInvite,
        subject: row.subjectSnapshot,
        previewHtml: row.htmlSnapshot,
        previewText: row.textSnapshot,
        recipientName: `${row.contactFirstName} ${row.contactLastName}`,
        recipientEmail: row.contactEmail,
        testSentAt: row.testSentAt ? row.testSentAt.toISOString() : null,
        founderEmail,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The client message could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
