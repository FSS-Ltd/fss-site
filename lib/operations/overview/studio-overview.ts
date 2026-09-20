import { portalPath } from "../auth/portal-url";
import type { FssAdminContext } from "../auth/staff-types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import {
  listStaffAgreementOverview,
  type StaffAgreementOverviewRow,
} from "../agreements/repository";
import {
  listStaffSigningReadiness,
  type StaffSigningReadiness,
} from "../agreements/signing-repository";
import { signingEnabled } from "../agreements/signing-worker";
import { readBillingConfiguration } from "../billing/configuration";
import type { OperationsDb } from "../db/client";
import {
  listStaffJourneyOverview,
  type StaffJourneyOverviewRow,
} from "../onboarding/queries";
import { onboardingEnabled } from "../onboarding/worker-db";
import type { RequestPriority, RequestStatus } from "../requests/types";
import {
  listStaffBillingExceptions,
  type StaffBillingException,
} from "../workspaces/staff-repository";

export type StudioDeliveryRequest = Readonly<{
  blocked: boolean;
  id: string;
  nextAction: string;
  organisationId: string;
  organisationName: string;
  priority: RequestPriority;
  reviewReminderTarget: string | null;
  status: RequestStatus;
  title: string;
}>;

export type StudioDeliverySummary = Readonly<{
  blockedCount: number;
  items: readonly StudioDeliveryRequest[];
  reviewCount: number;
}>;

export type StudioOverview = Readonly<{
  agreements: readonly StaffAgreementOverviewRow[];
  billing: readonly StaffBillingException[] | null;
  delivery: StudioDeliverySummary;
  journeys: readonly StaffJourneyOverviewRow[] | null;
  signing: readonly StaffSigningReadiness[] | null;
}>;

export type StudioAttentionItem = Readonly<{
  actionLabel: string;
  description: string;
  href: string;
  kind: "billing" | "delivery" | "journey" | "review" | "signing";
  state: "failed" | "overdue" | "waiting";
  title: string;
}>;

type StudioDeliveryRow = StudioDeliveryRequest & {
  blockedCount: number;
  reviewCount: number;
};

function adminHref(pathname: string): string {
  return portalPath(`/portal/admin${pathname}`);
}

function isPast(value: string | null, asOf: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < asOf.getTime();
}

function countAgreementDrafts(
  agreements: readonly StaffAgreementOverviewRow[],
): number {
  return agreements.reduce((total, organisation) => total + organisation.draftCount, 0);
}

function hasBillingConfiguration(): boolean {
  try {
    return readBillingConfiguration().enabled;
  } catch {
    return false;
  }
}

async function loadStudioDeliverySummary(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<StudioDeliverySummary> {
  const rows = await withFssAdminTransaction(db, admin, (tx) =>
    tx<StudioDeliveryRow[]>`
      select
        r.id,
        r.organisation_id as "organisationId",
        o.display_name as "organisationName",
        r.title,
        r.status,
        r.priority,
        r.next_action as "nextAction",
        r.review_reminder_target::text as "reviewReminderTarget",
        r.blocked_since is not null as blocked,
        count(*) filter (where r.status = 'ready_for_review') over ()::integer as "reviewCount",
        count(*) filter (where r.blocked_since is not null) over ()::integer as "blockedCount"
      from operations.requests r
      join operations.organisations o
        on o.id = r.organisation_id and o.lifecycle = 'active'
      where r.status not in ('done', 'cancelled')
      order by
        case
          when r.status = 'ready_for_review'
            and r.review_reminder_target <= clock_timestamp() then 0
          when r.blocked_since is not null then 1
          when r.status = 'ready_for_review' then 2
          else 3
        end,
        case r.priority
          when 'urgent' then 0
          when 'high' then 1
          when 'normal' then 2
          else 3
        end,
        r.created_at asc,
        r.id
      limit 100
    `,
  );
  const first = rows[0];

  return {
    blockedCount: first?.blockedCount ?? 0,
    items: rows.map((row) => ({
      blocked: row.blocked,
      id: row.id,
      nextAction: row.nextAction,
      organisationId: row.organisationId,
      organisationName: row.organisationName,
      priority: row.priority,
      reviewReminderTarget: row.reviewReminderTarget,
      status: row.status,
      title: row.title,
    })),
    reviewCount: first?.reviewCount ?? 0,
  };
}

/**
 * Read only cross-client summaries through staff-scoped repositories. The
 * delivery summary is a single aggregate because the existing paginated board
 * cannot provide exact review and blocker counts for the overview.
 */
export async function loadStudioOverview(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<StudioOverview> {
  const journeysEnabled = onboardingEnabled();
  const billingEnabled = hasBillingConfiguration();
  const signingIsEnabled = signingEnabled();
  const [delivery, agreements, journeys, signing, billing] = await Promise.all([
    loadStudioDeliverySummary(db, admin),
    listStaffAgreementOverview(db, admin),
    journeysEnabled ? listStaffJourneyOverview(db, admin) : Promise.resolve(null),
    signingIsEnabled ? listStaffSigningReadiness(db, admin) : Promise.resolve(null),
    billingEnabled
      ? listStaffBillingExceptions(db, admin, { page: 1 })
      : Promise.resolve(null),
  ]);

  return {
    agreements,
    billing: billing?.items ?? null,
    delivery,
    journeys,
    signing,
  };
}

export function getStudioOverviewMetrics(
  overview: StudioOverview,
): readonly Readonly<{ label: string; value: number; href: string }>[] {
  return [
    {
      href: `${adminHref("/delivery")}?status=ready_for_review`,
      label: "Awaiting client review",
      value: overview.delivery.reviewCount,
    },
    {
      href: adminHref("/delivery"),
      label: "Blocked delivery",
      value: overview.delivery.blockedCount,
    },
    {
      href: adminHref("/agreements"),
      label: "Agreement drafts",
      value: countAgreementDrafts(overview.agreements),
    },
    ...(overview.journeys
      ? [
          {
            href: adminHref("/welcome"),
            label: "Welcome recoveries",
            value: overview.journeys.reduce(
              (total, organisation) => total + organisation.recoveryCount,
              0,
            ),
          },
        ]
      : []),
  ];
}

export function selectStudioAttention(
  overview: StudioOverview,
  asOf: Date = new Date(),
): StudioAttentionItem[] {
  const attention: StudioAttentionItem[] = [];
  const review = overview.delivery.items.find(
    (request) => request.status === "ready_for_review",
  );
  if (review) {
    const overdue = isPast(review.reviewReminderTarget, asOf);
    attention.push({
      actionLabel: "Open delivery",
      description: `${review.organisationName} · ${review.nextAction}`,
      href: `${adminHref("/delivery")}?status=ready_for_review`,
      kind: "review",
      state: overdue ? "overdue" : "waiting",
      title: `${overdue ? "Overdue review" : "Review waiting"}: ${review.title}`,
    });
  }

  const blocked = overview.delivery.items.find(
    (request) => request.blocked && request.id !== review?.id,
  );
  if (blocked) {
    attention.push({
      actionLabel: "Open delivery",
      description: `${blocked.organisationName} · ${blocked.nextAction}`,
      href: adminHref("/delivery"),
      kind: "delivery",
      state: "failed",
      title: `Blocked delivery: ${blocked.title}`,
    });
  }

  const journey = overview.journeys?.find(
    (candidate) => candidate.recoveryCount > 0,
  );
  if (journey) {
    attention.push({
      actionLabel: "Open journey",
      description: `${journey.recoveryCount} welcome ${journey.recoveryCount === 1 ? "journey needs" : "journeys need"} recovery review.`,
      href: adminHref(`/clients/${journey.organisationId}/journey`),
      kind: "journey",
      state: "failed",
      title: `Welcome recovery: ${journey.organisationName}`,
    });
  }

  const signing = overview.signing?.[0];
  if (signing) {
    const waitingForSignatures = signing.status === "approved";
    attention.push({
      actionLabel: "Open signing",
      description: waitingForSignatures
        ? "The agreement is waiting for the required signatures."
        : signing.status === "expired"
          ? "The signature window has expired and needs renewal."
          : "The exact signing request is ready for staff approval.",
      href: adminHref(`/clients/${signing.organisationId}/signing`),
      kind: "signing",
      state: signing.status === "expired" ? "failed" : "waiting",
      title: `Signing: ${signing.title}`,
    });
  }

  const billing = overview.billing?.[0];
  if (billing) {
    attention.push({
      actionLabel: "Open billing",
      description: `${billing.organisationName ?? "Unassigned organisation"} · ${billing.category.replaceAll("_", " ")}`,
      href: adminHref("/billing"),
      kind: "billing",
      state: "failed",
      title: "Billing exception",
    });
  }

  return attention;
}
