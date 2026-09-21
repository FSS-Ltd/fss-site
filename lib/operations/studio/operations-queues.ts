import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import {
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "../workspaces/pagination";

const notificationStatusSchema = z.enum([
  "all",
  "pending",
  "retry",
  "succeeded",
  "held",
  "needs_attention",
]);

const billingInputSchema = z.strictObject({
  organisationId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(10_000),
});

const notificationInputSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000),
  status: notificationStatusSchema.optional(),
});

export type StudioBillingOperation = Readonly<{
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  providerReference: string | null;
  amountPence: string | null;
  dueDate: string | null;
  category: string;
  lastObservedAt: string;
}>;

export type StudioBillingOperations = WorkspaceCollectionPage<StudioBillingOperation> &
  Readonly<{
    dueThisMonthPence: string;
    overduePence: string;
    reconciliationCount: number;
  }>;

export type StudioNotificationDelivery = Readonly<{
  id: string;
  organisationId: string;
  organisationName: string;
  requestId: string;
  requestTitle: string;
  kind: "review_requested" | "accepted" | "closed";
  recipientLabel: string;
  status: "pending" | "succeeded" | "held";
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string;
  updatedAt: string;
}>;

function notificationDatabaseStatus(
  status: z.infer<typeof notificationStatusSchema> | undefined,
): "pending" | "succeeded" | "held" | null {
  if (status === "retry") return "pending";
  if (status === "needs_attention") return "held";
  if (status === "all" || status === undefined) return null;
  return status;
}

function maskedRecipient(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Recipient withheld";
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function listStudioBillingOperations(
  db: OperationsDb,
  admin: FssAdminContext,
  input: unknown,
): Promise<StudioBillingOperations> {
  const parsed = billingInputSchema.parse(input);
  const organisationId = parsed.organisationId ?? null;
  const offset = workspacePageOffset(parsed.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [totals] = await tx<
      Array<{
        dueThisMonthPence: string | null;
        overduePence: string | null;
        reconciliationCount: number;
      }>
    >`
      select
        coalesce(sum(i.amount_remaining_pence) filter (
          where i.status = 'open'
            and i.due_date >= date_trunc('month', current_date)::date
            and i.due_date < (date_trunc('month', current_date) + interval '1 month')::date
        ), 0)::text as "dueThisMonthPence",
        coalesce(sum(i.amount_remaining_pence) filter (
          where i.status = 'open' and i.due_date < current_date
        ), 0)::text as "overduePence",
        (select count(*)::integer from operations.billing_exceptions e
          where e.resolved_at is null
            and (${organisationId}::uuid is null or e.organisation_id = ${organisationId}::uuid)
        ) as "reconciliationCount"
      from operations.invoices i
      where (${organisationId}::uuid is null or i.organisation_id = ${organisationId}::uuid)
    `;
    const rows = await tx<StudioBillingOperation[]>`
      select e.id, e.organisation_id as "organisationId",
        o.display_name as "organisationName",
        i.provider_invoice_id as "providerReference",
        i.amount_remaining_pence::text as "amountPence",
        i.due_date::text as "dueDate",
        e.category, e.last_seen_at::text as "lastObservedAt"
      from operations.billing_exceptions e
      left join operations.organisations o on o.id = e.organisation_id
      left join operations.invoices i
        on i.account_id = e.account_id
          and i.environment = e.environment
          and i.provider_invoice_id = e.object_id
      where e.resolved_at is null
        and (${organisationId}::uuid is null or e.organisation_id = ${organisationId}::uuid)
      order by e.last_seen_at desc, e.id desc
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    const total = totals ?? {
      dueThisMonthPence: "0",
      overduePence: "0",
      reconciliationCount: 0,
    };
    return {
      ...toWorkspaceCollectionPage(rows, parsed.page),
      dueThisMonthPence: total.dueThisMonthPence ?? "0",
      overduePence: total.overduePence ?? "0",
      reconciliationCount: total.reconciliationCount,
    };
  });
}

export async function listStudioNotifications(
  db: OperationsDb,
  admin: FssAdminContext,
  input: unknown,
): Promise<WorkspaceCollectionPage<StudioNotificationDelivery>> {
  const parsed = notificationInputSchema.parse(input);
  const status = notificationDatabaseStatus(parsed.status);
  const offset = workspacePageOffset(parsed.page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const rows = await tx<
      Array<Omit<StudioNotificationDelivery, "recipientLabel"> & { recipient: string }>
    >`
      select d.id, d.organisation_id as "organisationId",
        o.display_name as "organisationName", d.request_id as "requestId",
        r.title as "requestTitle", d.kind, d.recipient, d.status, d.attempts,
        d.next_attempt_at::text as "nextAttemptAt", d.last_error as "lastError",
        d.updated_at::text as "updatedAt"
      from operations.request_email_deliveries d
      join operations.organisations o on o.id = d.organisation_id
      join operations.requests r
        on r.organisation_id = d.organisation_id and r.id = d.request_id
      where (${status}::text is null or d.status = ${status}::text)
      order by d.updated_at desc, d.id desc
      limit ${workspacePageSize + 1} offset ${offset}
    `;
    return toWorkspaceCollectionPage(
      rows.map(({ recipient, ...delivery }) => ({
        ...delivery,
        recipientLabel: maskedRecipient(recipient),
      })),
      parsed.page,
    );
  });
}
