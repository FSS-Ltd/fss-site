import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import { COMMERCIAL_STAGES, type CommercialStage, type DeliveryStatus } from "../pipeline/stages";
import type { ViewState } from "./view-models";

const PAGE_SIZE = 20;
const MAX_EVIDENCE_ITEMS = 50;
const MAX_HISTORY_ENTRIES = 100;

const ENGAGEMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// An engagement's value is a forecast until it is won; once won it is the
// agreed figure the founder closed on. Same columns, different meaning -
// the read model surfaces which one a caller is looking at rather than
// letting a UI mislabel a forecast as revenue.
export type DealValueKind = "estimated" | "agreed";

function valueKindForStage(stage: CommercialStage): DealValueKind {
  return stage === "won" ? "agreed" : "estimated";
}

export const DEAL_STAGE_FILTER_VALUES = ["all", ...COMMERCIAL_STAGES] as const;
export type DealStageFilter = (typeof DEAL_STAGE_FILTER_VALUES)[number];

// Minimum-value bands in pence: all, £500+, £2,000+, £5,000+.
export const DEAL_VALUE_BAND_VALUES = ["all", "50000", "200000", "500000"] as const;
export type DealValueBand = (typeof DEAL_VALUE_BAND_VALUES)[number];

export const DEAL_NEXT_ACTION_FILTER_VALUES = [
  "all",
  "overdue",
  "upcoming",
  "none",
] as const;
export type DealNextActionFilter = (typeof DEAL_NEXT_ACTION_FILTER_VALUES)[number];

export type DealListQuery = {
  stage: DealStageFilter;
  valueBandMin: DealValueBand;
  owner: string;
  nextAction: DealNextActionFilter;
  after: string | null;
};

export type DealListRow = {
  engagementId: string;
  version: number;
  businessName: string;
  primaryContactName: string | null;
  offerFocus: string;
  stage: CommercialStage;
  valuePence: number;
  valueKind: DealValueKind;
  nextAction: string | null;
  nextActionDueAt: string | null;
  updatedAt: string;
};

export type DealListResult = {
  rows: readonly DealListRow[];
  totalCount: number;
  nextCursor: string | null;
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

const OWNER_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseDealListQuery(searchParams: RawSearchParams): DealListQuery {
  const owner = (firstValue(searchParams.owner) ?? "").trim();
  const after = (firstValue(searchParams.after) ?? "").trim();

  return {
    stage: parseEnumParam(DEAL_STAGE_FILTER_VALUES, firstValue(searchParams.stage)),
    valueBandMin: parseEnumParam(
      DEAL_VALUE_BAND_VALUES,
      firstValue(searchParams.valueBandMin),
    ),
    owner: OWNER_PATTERN.test(owner) ? owner : "",
    nextAction: parseEnumParam(
      DEAL_NEXT_ACTION_FILTER_VALUES,
      firstValue(searchParams.nextAction),
    ),
    after: after.length > 0 && after.length <= 400 ? after : null,
  };
}

type DealCursor = { updatedAt: string; engagementId: string };

export function encodeDealCursor(row: DealListRow): string {
  const cursor: DealCursor = { updatedAt: row.updatedAt, engagementId: row.engagementId };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDealCursor(value: string): DealCursor | null {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof (decoded as DealCursor).updatedAt === "string" &&
      typeof (decoded as DealCursor).engagementId === "string"
    ) {
      return decoded as DealCursor;
    }
    return null;
  } catch {
    return null;
  }
}

function buildFilterFragments(db: GrowthQueryExecutor, query: DealListQuery) {
  const stage = query.stage === "all" ? db`` : db`and de.stage = ${query.stage}`;

  const valueBandMin =
    query.valueBandMin === "all"
      ? db``
      : db`and (coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0)) >= ${Number(query.valueBandMin)}`;

  const owner = query.owner ? db`and p.assigned_owner_email = ${query.owner}` : db``;

  const nextAction =
    query.nextAction === "all"
      ? db``
      : query.nextAction === "overdue"
        ? db`and p.next_action_due_at is not null and p.next_action_due_at < now()`
        : query.nextAction === "upcoming"
          ? db`and p.next_action_due_at is not null and p.next_action_due_at >= now()`
          : db`and p.next_action_due_at is null`;

  return { stage, valueBandMin, owner, nextAction };
}

async function fetchDealRows(
  db: GrowthQueryExecutor,
  query: DealListQuery,
): Promise<{ rows: DealListRow[]; nextCursor: string | null }> {
  const fragments = buildFilterFragments(db, query);
  const cursor = query.after ? decodeDealCursor(query.after) : null;
  const cursorFragment = cursor
    ? db`and (
        de.updated_at < ${cursor.updatedAt}::timestamptz
        or (de.updated_at = ${cursor.updatedAt}::timestamptz and de.id > ${cursor.engagementId})
      )`
    : db``;

  const rows = await db<
    (Omit<DealListRow, "valueKind" | "updatedAt"> & { updatedAt: Date })[]
  >`
    select
      de.id as "engagementId",
      de.version,
      b.legal_name as "businessName",
      c.first_name || ' ' || c.last_name as "primaryContactName",
      de.name as "offerFocus",
      de.stage,
      (coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0)) as "valuePence",
      p.next_action as "nextAction",
      p.next_action_due_at as "nextActionDueAt",
      de.updated_at as "updatedAt"
    from growth.delivery_engagements de
    inner join growth.prospects p on p.id = de.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    left join growth.contacts c on c.id = p.primary_contact_id
    where true
      ${fragments.stage}
      ${fragments.valueBandMin}
      ${fragments.owner}
      ${fragments.nextAction}
      ${cursorFragment}
    order by de.updated_at desc, de.id asc
    limit ${PAGE_SIZE + 1}
  `;

  const hasNextPage = rows.length > PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
  const shaped = page.map((row) => ({
    ...row,
    valueKind: valueKindForStage(row.stage),
    updatedAt: row.updatedAt.toISOString(),
  }));
  const last = shaped.at(-1);

  return {
    rows: shaped,
    nextCursor: hasNextPage && last ? encodeDealCursor(last) : null,
  };
}

async function fetchDealTotalCount(
  db: GrowthQueryExecutor,
  query: DealListQuery,
): Promise<number> {
  const fragments = buildFilterFragments(db, query);

  const rows = await db<{ count: number }[]>`
    select count(*)::int as count
    from growth.delivery_engagements de
    inner join growth.prospects p on p.id = de.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    left join growth.contacts c on c.id = p.primary_contact_id
    where true
      ${fragments.stage}
      ${fragments.valueBandMin}
      ${fragments.owner}
      ${fragments.nextAction}
  `;

  return rows[0]?.count ?? 0;
}

export async function getDealListResult(
  query: DealListQuery,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ViewState<DealListResult>> {
  try {
    const [{ rows, nextCursor }, totalCount] = await Promise.all([
      fetchDealRows(db, query),
      fetchDealTotalCount(db, query),
    ]);

    return { status: "ready", data: { rows, totalCount, nextCursor } };
  } catch {
    return {
      status: "error",
      message: "The deal list could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export type DealDetailBusiness = {
  legalName: string;
  tradingName: string | null;
  sector: string;
  locality: string;
  websiteUrl: string | null;
};

export type DealDetailContact = {
  firstName: string;
  lastName: string;
  roleTitle: string | null;
  email: string;
};

export type DealCorrespondence = {
  sequenceId: string;
  status: string;
  lastActivityAt: string;
};

export type DealEvidenceItem = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  claimType: string;
  claimSummary: string;
  observedAt: string;
};

export type CommercialHistoryEntry = {
  id: string;
  fromState: string;
  toState: string;
  reasonCode: string | null;
  occurredAt: string;
};

export type DealDetail = {
  engagementId: string;
  version: number;
  prospectId: string;
  prospectVersion: number;
  stage: CommercialStage;
  offerFocus: string;
  oneOffValuePence: number | null;
  monthlyValuePence: number | null;
  valueKind: DealValueKind;
  probabilityPercent: number;
  expectedCloseDate: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lossReason: string | null;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  business: DealDetailBusiness;
  contact: DealDetailContact | null;
  opportunitySummary: string;
  proposedScope: string;
  nextAction: string | null;
  nextActionDueAt: string | null;
  correspondence: DealCorrespondence | null;
  evidence: readonly DealEvidenceItem[];
  commercialHistory: readonly CommercialHistoryEntry[];
};

export type DealDetailResult =
  | { status: "found"; data: DealDetail }
  | { status: "not_found" }
  | { status: "error"; message: string; correlationId: string };

type CoreRow = {
  engagementId: string;
  version: number;
  prospectId: string;
  prospectVersion: number;
  stage: CommercialStage;
  offerFocus: string;
  oneOffValuePence: number | null;
  monthlyValuePence: number | null;
  probabilityPercent: number;
  expectedCloseDate: Date | null;
  wonAt: Date | null;
  lostAt: Date | null;
  lossReason: string | null;
  deliveryStatus: DeliveryStatus;
  createdAt: Date;
  updatedAt: Date;
  businessLegalName: string;
  businessTradingName: string | null;
  businessSector: string;
  businessLocality: string;
  businessWebsiteUrl: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactRoleTitle: string | null;
  contactEmail: string | null;
  opportunitySummary: string;
  proposedScope: string;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  sequenceId: string | null;
  sequenceStatus: string | null;
  sequenceLastActivityAt: Date | null;
};

async function fetchCoreRow(
  db: GrowthQueryExecutor,
  engagementId: string,
): Promise<CoreRow | null> {
  const rows = await db<CoreRow[]>`
    select
      de.id as "engagementId",
      de.version,
      de.prospect_id as "prospectId",
      p.version as "prospectVersion",
      de.stage,
      de.name as "offerFocus",
      de.one_off_value_pence as "oneOffValuePence",
      de.monthly_value_pence as "monthlyValuePence",
      de.probability_percent as "probabilityPercent",
      de.expected_close_date as "expectedCloseDate",
      de.won_at as "wonAt",
      de.lost_at as "lostAt",
      de.loss_reason as "lossReason",
      de.delivery_status as "deliveryStatus",
      de.created_at as "createdAt",
      de.updated_at as "updatedAt",
      b.legal_name as "businessLegalName",
      b.trading_name as "businessTradingName",
      b.sector as "businessSector",
      b.locality as "businessLocality",
      b.website_url as "businessWebsiteUrl",
      c.first_name as "contactFirstName",
      c.last_name as "contactLastName",
      c.role_title as "contactRoleTitle",
      c.email as "contactEmail",
      p.opportunity_summary as "opportunitySummary",
      p.recommended_offer as "proposedScope",
      p.next_action as "nextAction",
      p.next_action_due_at as "nextActionDueAt",
      seq.id as "sequenceId",
      seq.status as "sequenceStatus",
      seq."lastActivityAt" as "sequenceLastActivityAt"
    from growth.delivery_engagements de
    inner join growth.prospects p on p.id = de.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    left join growth.contacts c on c.id = p.primary_contact_id
    left join lateral (
      select
        se.id,
        se.status,
        coalesce(
          (select max(em.sent_at) from growth.email_messages em where em.sequence_enrollment_id = se.id),
          se.started_at
        ) as "lastActivityAt"
      from growth.sequence_enrollments se
      where se.prospect_id = p.id
      order by se.created_at desc
      limit 1
    ) seq on true
    where de.id = ${engagementId}
    limit 1
  `;

  return rows[0] ?? null;
}

async function fetchEvidence(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<DealEvidenceItem[]> {
  const rows = await db<
    (Omit<DealEvidenceItem, "observedAt"> & { observedAt: Date })[]
  >`
    select
      id,
      source_type as "sourceType",
      source_url as "sourceUrl",
      claim_type as "claimType",
      claim_summary as "claimSummary",
      observed_at as "observedAt"
    from growth.source_evidence
    where prospect_id = ${prospectId}
    order by verified_at desc
    limit ${MAX_EVIDENCE_ITEMS}
  `;

  return rows.map((row) => ({ ...row, observedAt: row.observedAt.toISOString() }));
}

async function fetchCommercialHistory(
  db: GrowthQueryExecutor,
  engagementId: string,
): Promise<CommercialHistoryEntry[]> {
  const rows = await db<
    (Omit<CommercialHistoryEntry, "occurredAt"> & { occurredAt: Date })[]
  >`
    select id, from_state as "fromState", to_state as "toState", reason_code as "reasonCode",
           occurred_at as "occurredAt"
    from growth.commercial_stage_events
    where engagement_id = ${engagementId} and dimension = 'commercial'
    order by occurred_at desc
    limit ${MAX_HISTORY_ENTRIES}
  `;

  return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
}

function toDealDetail(
  core: CoreRow,
  evidence: readonly DealEvidenceItem[],
  commercialHistory: readonly CommercialHistoryEntry[],
): DealDetail {
  const contact: DealDetailContact | null =
    core.contactEmail && core.contactFirstName && core.contactLastName
      ? {
          firstName: core.contactFirstName,
          lastName: core.contactLastName,
          roleTitle: core.contactRoleTitle,
          email: core.contactEmail,
        }
      : null;

  const correspondence: DealCorrespondence | null =
    core.sequenceId && core.sequenceStatus && core.sequenceLastActivityAt
      ? {
          sequenceId: core.sequenceId,
          status: core.sequenceStatus,
          lastActivityAt: core.sequenceLastActivityAt.toISOString(),
        }
      : null;

  return {
    engagementId: core.engagementId,
    version: core.version,
    prospectId: core.prospectId,
    prospectVersion: core.prospectVersion,
    stage: core.stage,
    offerFocus: core.offerFocus,
    oneOffValuePence: core.oneOffValuePence,
    monthlyValuePence: core.monthlyValuePence,
    valueKind: valueKindForStage(core.stage),
    probabilityPercent: core.probabilityPercent,
    expectedCloseDate: core.expectedCloseDate
      ? core.expectedCloseDate.toISOString().slice(0, 10)
      : null,
    wonAt: core.wonAt ? core.wonAt.toISOString() : null,
    lostAt: core.lostAt ? core.lostAt.toISOString() : null,
    lossReason: core.lossReason,
    deliveryStatus: core.deliveryStatus,
    createdAt: core.createdAt.toISOString(),
    updatedAt: core.updatedAt.toISOString(),
    business: {
      legalName: core.businessLegalName,
      tradingName: core.businessTradingName,
      sector: core.businessSector,
      locality: core.businessLocality,
      websiteUrl: core.businessWebsiteUrl,
    },
    contact,
    opportunitySummary: core.opportunitySummary,
    proposedScope: core.proposedScope,
    nextAction: core.nextAction,
    nextActionDueAt: core.nextActionDueAt ? core.nextActionDueAt.toISOString() : null,
    correspondence,
    evidence,
    commercialHistory,
  };
}

export async function getDealDetail(
  engagementId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<DealDetailResult> {
  if (!ENGAGEMENT_ID_PATTERN.test(engagementId)) {
    return { status: "not_found" };
  }

  try {
    const core = await fetchCoreRow(db, engagementId);
    if (!core) return { status: "not_found" };

    const [evidence, commercialHistory] = await Promise.all([
      fetchEvidence(db, core.prospectId),
      fetchCommercialHistory(db, engagementId),
    ]);

    return {
      status: "found",
      data: toDealDetail(core, evidence, commercialHistory),
    };
  } catch {
    return {
      status: "error",
      message: "The deal record could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
