import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";

// Every windowed metric in this module is measured against this timezone:
// a "day" or "month" means a London calendar day or month, converted to an
// explicit UTC range before it ever reaches SQL. Money is integer pence,
// ISO GBP. Agreed and won values are commercial figures the founder closed
// on - never call them "revenue" until an accounting definition exists.
export const ANALYTICS_TIMEZONE = "Europe/London" as const;

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type LondonCalendarRange = {
  /** Inclusive first London calendar day, "YYYY-MM-DD". */
  startDate: string;
  /** Inclusive last London calendar day, "YYYY-MM-DD". */
  endDate: string;
};

export type UtcWindow = {
  /** Inclusive lower bound. */
  startUtc: Date;
  /** Exclusive upper bound - the window is [startUtc, endUtc). */
  endUtc: Date;
};

function parseCalendarDate(value: string): { year: number; month: number; day: number } {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`"${value}" is not a YYYY-MM-DD calendar date.`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Converts an inclusive London calendar-day range into an explicit,
 * half-open UTC window. The end bound is midnight London time on the day
 * *after* endDate, so a caller can filter with `>= startUtc and < endUtc`
 * without any per-column timezone conversion or off-by-one risk. */
export function resolveUtcWindow(range: LondonCalendarRange): UtcWindow {
  const start = parseCalendarDate(range.startDate);
  const end = parseCalendarDate(range.endDate);
  const startUtc = new TZDate(start.year, start.month - 1, start.day, ANALYTICS_TIMEZONE);
  const endUtcExclusiveDay = addDays(
    new TZDate(end.year, end.month - 1, end.day, ANALYTICS_TIMEZONE),
    1,
  );

  if (startUtc.getTime() > endUtcExclusiveDay.getTime()) {
    throw new RangeError("A calendar range's start date must not be after its end date.");
  }

  return {
    startUtc: new Date(startUtc.getTime()),
    endUtc: new Date(endUtcExclusiveDay.getTime()),
  };
}

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Resolves a "YYYY-MM" London calendar month into its full day range,
 * e.g. "2026-08" -> { startDate: "2026-08-01", endDate: "2026-08-31" }. */
export function resolveLondonMonthRange(monthKey: string): LondonCalendarRange {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) {
    throw new RangeError(`"${monthKey}" is not a YYYY-MM calendar month.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new RangeError(`"${monthKey}" is not a valid calendar month.`);
  }
  const lastDay = daysInMonth(year, month);
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** The current London calendar month as "YYYY-MM", from a UTC instant. */
export function currentLondonMonthKey(now: Date): string {
  const zoned = new TZDate(now, ANALYTICS_TIMEZONE);
  return `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, "0")}`;
}

// --- Metric definitions ------------------------------------------------
//
// Every metric here is defined before any SQL exists for it. A definition
// states exactly what event makes a record count, when it counts (which
// timestamp, which timezone), and what an empty denominator means - so the
// numbers on the analytics page can always be traced back to a specific
// row in a specific table.

export type MetricKind = "count" | "money_pence" | "rate";

export type MetricDefinition = {
  id: string;
  label: string;
  kind: MetricKind;
  /** What is counted or summed, and the source table/column. */
  numerator: string;
  /** For a rate: what it is divided by. Null for a plain count or sum. */
  denominator: string | null;
  /** Which timestamp column decides whether a record falls in the window. */
  inclusionTime: string;
  /** Whether the metric is filtered to the requested window, or is a
   * point-in-time snapshot as of "now" regardless of the window. */
  windowing: "windowed" | "point_in_time_snapshot";
  /** What the metric reports when its denominator is zero. */
  emptyDenominatorBehaviour: string;
};

export const FUNNEL_METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: "researchedProspects",
    label: "Researched prospects",
    kind: "count",
    numerator:
      "Count of growth.prospects rows whose created_at falls in the window. A prospect row only exists as accepted output of a growth.research_runs run, so this is the count of prospects research accepted into the pipeline, not raw candidates considered.",
    denominator: null,
    inclusionTime: "growth.prospects.created_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a raw count, not a rate.",
  },
  {
    id: "approvedFirstEmails",
    label: "Approved first emails",
    kind: "count",
    numerator:
      "Count of growth.sequence_enrollments rows whose created_at falls in the window. Each enrollment is created exactly once, at the moment the founder approves that prospect's first email (see lib/growth/sequences/approval.ts), so this counts founder approvals, not provider sends.",
    denominator: null,
    inclusionTime: "growth.sequence_enrollments.created_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a raw count, not a rate.",
  },
  {
    id: "replies",
    label: "Replies",
    kind: "count",
    numerator:
      "Count of distinct sequence_enrollment_id values on growth.email_messages rows with direction = 'inbound' and received_at in the window. Counting distinct enrollments (not raw inbound rows) means a thread with several inbound messages, or a duplicate provider webhook re-delivering the same message, still counts as one reply.",
    denominator: null,
    inclusionTime: "growth.email_messages.received_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a raw count, not a rate.",
  },
  {
    id: "qualifiedOpportunities",
    label: "Qualified opportunities",
    kind: "count",
    numerator:
      "Count of distinct engagement_id values on growth.commercial_stage_events rows with dimension = 'commercial', to_state = 'qualified', and occurred_at in the window.",
    denominator: null,
    inclusionTime: "growth.commercial_stage_events.occurred_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a raw count, not a rate.",
  },
  {
    id: "proposals",
    label: "Proposals",
    kind: "count",
    numerator:
      "Count of distinct engagement_id values on growth.commercial_stage_events rows with dimension = 'commercial', to_state = 'proposal', and occurred_at in the window.",
    denominator: null,
    inclusionTime: "growth.commercial_stage_events.occurred_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a raw count, not a rate.",
  },
  {
    id: "wins",
    label: "Wins",
    kind: "count",
    numerator:
      "Count of distinct engagement_id values on growth.commercial_stage_events rows with dimension = 'commercial', to_state = 'won', and occurred_at in the window. Reconciles to growth.delivery_engagements rows with stage = 'won' and won_at in the same window.",
    denominator: null,
    inclusionTime: "growth.commercial_stage_events.occurred_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a raw count, not a rate.",
  },
];

export const VALUE_METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: "openPipelineValue",
    label: "Open pipeline value",
    kind: "money_pence",
    numerator:
      "Sum of (one_off_value_pence + monthly_value_pence) across growth.delivery_engagements rows whose stage is one of the open commercial stages (new, qualified, proposal, negotiation - see OPEN_PIPELINE_STAGES). A forecast, not agreed or recognised revenue.",
    denominator: null,
    inclusionTime: "n/a - a snapshot of current engagement rows, not an event window",
    windowing: "point_in_time_snapshot",
    emptyDenominatorBehaviour: "n/a - this is a sum, not a rate.",
  },
  {
    id: "agreedWonValue",
    label: "Agreed won value",
    kind: "money_pence",
    numerator:
      "Sum of (one_off_value_pence + monthly_value_pence) across growth.delivery_engagements rows with stage = 'won' and won_at in the window. This is the value the founder agreed on at close, not recognised accounting revenue.",
    denominator: null,
    inclusionTime: "growth.delivery_engagements.won_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a sum, not a rate.",
  },
  {
    id: "completedDeliveryValue",
    label: "Completed delivery value",
    kind: "money_pence",
    numerator:
      "Sum of (one_off_value_pence + monthly_value_pence) across growth.delivery_engagements rows that have a growth.commercial_stage_events row with dimension = 'delivery', to_state = 'complete', and occurred_at in the window (first reach of complete only, matching the append-only history).",
    denominator: null,
    inclusionTime: "growth.commercial_stage_events.occurred_at (dimension = 'delivery')",
    windowing: "windowed",
    emptyDenominatorBehaviour: "n/a - this is a sum, not a rate.",
  },
];

export const CONVERSION_RATE_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: "replyRate",
    label: "Reply rate",
    kind: "rate",
    numerator: "replies (see FUNNEL_METRIC_DEFINITIONS)",
    denominator: "approvedFirstEmails",
    inclusionTime: "each side uses its own metric's inclusion time, both within the same window",
    windowing: "windowed",
    emptyDenominatorBehaviour:
      "Reports null (not 0%) when approvedFirstEmails is 0 for the window, so an empty window is never misread as a 0% reply rate.",
  },
  {
    id: "meetingRate",
    label: "Meeting rate",
    kind: "rate",
    numerator:
      "Count of distinct prospect_id values in growth.audit_log with action = 'prospect.status_transitioned.started_talks' and created_at in the window (the founder's manual \"started talks\" milestone - see lib/growth/prospects/status-transition.ts).",
    denominator: "replies",
    inclusionTime: "growth.audit_log.created_at",
    windowing: "windowed",
    emptyDenominatorBehaviour: "Reports null (not 0%) when replies is 0 for the window.",
  },
  {
    id: "proposalRate",
    label: "Proposal rate",
    kind: "rate",
    numerator: "proposals (see FUNNEL_METRIC_DEFINITIONS)",
    denominator: "meetingRate's numerator (started_talks count)",
    inclusionTime: "each side uses its own metric's inclusion time, both within the same window",
    windowing: "windowed",
    emptyDenominatorBehaviour: "Reports null (not 0%) when the started_talks count is 0 for the window.",
  },
  {
    id: "winRate",
    label: "Win rate",
    kind: "rate",
    numerator: "wins (see FUNNEL_METRIC_DEFINITIONS)",
    denominator: "proposals",
    inclusionTime: "each side uses its own metric's inclusion time, both within the same window",
    windowing: "windowed",
    emptyDenominatorBehaviour: "Reports null (not 0%) when proposals is 0 for the window.",
  },
];

export const ALL_METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  ...FUNNEL_METRIC_DEFINITIONS,
  ...VALUE_METRIC_DEFINITIONS,
  ...CONVERSION_RATE_DEFINITIONS,
];

/** null when the denominator is 0 or absent, so a caller can never render a
 * misleading "0%" for an empty window. Matches buildSequenceHealth's
 * convention in lib/growth/dashboard/overview.ts. */
export function computeRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
