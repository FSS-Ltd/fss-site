import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { claimBillingEvents } from "./events";
import { applyInvoiceProjection, applyMandate } from "./projection-repository";
import {
  BillingReconciliationError,
  type BillingReconciliationProvider,
  type ProviderScope,
} from "./reconciliation-types";
export type BillingWorkerResult = {
  processed: number;
  exceptions: number;
  deferred: number;
};
function assertScope(
  provider: BillingReconciliationProvider,
  scope: ProviderScope,
): void {
  z.object({
    accountId: z.string().regex(/^acct_[A-Za-z0-9]+$/),
    mode: z.enum(["test", "live"]),
  }).parse(scope);
  if (
    provider.scope.accountId !== scope.accountId ||
    provider.scope.mode !== scope.mode
  )
    throw new BillingReconciliationError("scope_mismatch");
}
export async function reconcileBillingInvoice(
  db: OperationsDb,
  provider: BillingReconciliationProvider,
  invoiceId: string,
  deadline = Date.now() + 40000,
): Promise<void> {
  const { scope } = provider;
  const leaseToken = randomUUID();
  const claimed =
    await db`insert into operations.billing_projection_leases(account_id,environment,object_id,lease_token,lease_until) values(${scope.accountId},${scope.mode},${invoiceId},${leaseToken},now()+interval '5 minutes') on conflict(account_id,environment,object_id) do update set lease_token=excluded.lease_token,lease_until=excluded.lease_until where billing_projection_leases.lease_until<now() returning lease_token`;
  if (!claimed.length)
    throw new Error("Projection is already being reconciled.");
  try {
    // Provider I/O intentionally runs without an open database transaction.
    const snapshot = await withinBudget(
      provider.fetchInvoice(invoiceId),
      deadline,
    );
    if (snapshot.invoice.id !== invoiceId)
      throw new BillingReconciliationError("scope_mismatch");
    await db.begin(async (tx) => {
      const active =
        await tx`select lease_token from operations.billing_projection_leases where account_id=${scope.accountId} and environment=${scope.mode} and object_id=${invoiceId} and lease_token=${leaseToken} and lease_until>now() for update`;
      if (!active.length) throw new Error("Projection lease expired.");
      await applyInvoiceProjection(tx, scope, snapshot);
    });
  } finally {
    await db`update operations.billing_projection_leases set lease_until=now() where account_id=${scope.accountId} and environment=${scope.mode} and object_id=${invoiceId} and lease_token=${leaseToken}`;
  }
}
export async function runBillingEventWorker(
  db: OperationsDb,
  provider: BillingReconciliationProvider,
  scope: ProviderScope,
  options: { limit?: number; budgetMs?: number } = {},
): Promise<BillingWorkerResult> {
  assertScope(provider, scope);
  const limit = z
    .number()
    .int()
    .min(1)
    .max(20)
    .parse(options.limit ?? 10);
  const budgetMs = z
    .number()
    .int()
    .min(1000)
    .max(240000)
    .parse(options.budgetMs ?? 40000);
  const deadline = Date.now() + budgetMs;
  const result: BillingWorkerResult = {
    processed: 0,
    exceptions: 0,
    deferred: 0,
  };
  for (let index = 0; index < limit && Date.now() < deadline; index++) {
    const [event] = await claimBillingEvents(db, scope, 1);
    if (!event) break;
    try {
      const resolved = await withinBudget(
        provider.resolveEvent(event),
        deadline,
      );
      if (resolved.invoiceIds.length > 20)
        throw new BillingReconciliationError("incomplete_provider_data");
      for (const id of new Set(resolved.invoiceIds)) {
        if (Date.now() >= deadline)
          throw new Error("Reconciliation budget exhausted.");
        await reconcileBillingInvoice(db, provider, id, deadline);
      }
      await db.begin(async (tx) => {
        const active =
          await tx`select id from operations.billing_provider_events where id=${event.id} and lease_token=${event.leaseToken} and lease_until>now() for update`;
        if (!active.length) throw new Error("Event lease expired.");
        if (resolved.mandate) await applyMandate(tx, scope, resolved.mandate);
        if (resolved.setup) {
          const setup = resolved.setup;
          await tx`select operations.record_billing_setup_event(
            ${setup.setupId}::uuid,${event.eventId},${setup.kind},${setup.occurredAt}::timestamptz,
            ${setup.providerCustomerId},${setup.providerSessionId},${setup.setupIntentId},
            ${setup.providerMethodId},${setup.mandateId},${setup.method},
            ${setup.metadataOrganisationId}::uuid,${setup.metadataCurrency},
            ${setup.brand},${setup.last4},
            ${setup.expiresMonth},${setup.expiresYear}
          )`;
        }
        if (resolved.detachedMethodId)
          await tx`select operations.revoke_billing_payment_method(
            ${scope.accountId},${scope.mode},${resolved.detachedMethodId},${event.occurredAt}::timestamptz
          )`;
        await tx`update operations.billing_provider_events set state='completed',completed_at=now(),lease_token=null,lease_until=null where id=${event.id}`;
      });
      result.processed++;
    } catch (error) {
      const category =
        error instanceof BillingReconciliationError
          ? error.code
          : "provider_unavailable";
      const terminal =
        error instanceof BillingReconciliationError || event.attempts >= 8;
      await db.begin(async (tx) => {
        const changed =
          await tx`update operations.billing_provider_events set state=${terminal ? "exception" : "pending"},lease_token=null,lease_until=null,next_attempt_at=now()+interval '5 minutes' where id=${event.id} and lease_token=${event.leaseToken} returning id`;
        if (terminal && changed.length)
          await tx`insert into operations.billing_exceptions(account_id,environment,object_id,category,operation_key) values(${scope.accountId},${scope.mode},${event.objectId},${category},${`event:${event.id}`}) on conflict(operation_key) do update set last_seen_at=now(),resolved_at=null`;
      });
      if (terminal) result.exceptions++;
      else result.deferred++;
    }
  }
  return result;
}
type DailyProgress = {
  cursor: string | null;
  pendingInvoiceIds: string[];
  pendingCursor: string | null;
  pendingPage: boolean;
};
/** Persist page contents and each completed item so slow or failing suffixes cannot starve. */
export async function reconcileDailyBilling(
  db: OperationsDb,
  provider: BillingReconciliationProvider,
  scope: ProviderScope,
  options: { limit?: number; budgetMs?: number; now?: () => number } = {},
): Promise<{ processed: number; pending: boolean; skipped: boolean }> {
  assertScope(provider, scope);
  const limit = z
    .number()
    .int()
    .min(1)
    .max(20)
    .parse(options.limit ?? 10);
  const budgetMs = z
    .number()
    .int()
    .min(1000)
    .max(240000)
    .parse(options.budgetMs ?? 40000);
  const now = options.now ?? Date.now;
  const deadline = now() + budgetMs;
  await db`insert into operations.billing_reconciliation_cursors(account_id,environment) values(${scope.accountId},${scope.mode}) on conflict do nothing`;
  const leaseToken = randomUUID();
  const [claim] = await db<
    DailyProgress[]
  >`update operations.billing_reconciliation_cursors set lease_token=${leaseToken},lease_until=now()+interval '5 minutes' where account_id=${scope.accountId} and environment=${scope.mode} and next_run_at<=now() and (lease_until is null or lease_until<now()) returning cursor,pending_invoice_ids as "pendingInvoiceIds",pending_cursor as "pendingCursor",pending_page as "pendingPage"`;
  if (!claim) return { processed: 0, pending: false, skipped: true };
  let processed = 0;
  try {
    if (!claim.pendingPage) {
      const page = await withinBudget(
        provider.listInvoices(claim.cursor, limit),
        Date.now() + Math.max(0, deadline - now()),
      );
      if (
        page.invoiceIds.length > limit ||
        (page.cursor !== null && page.cursor === claim.cursor)
      )
        throw new BillingReconciliationError("incomplete_provider_data");
      const saved =
        await db`update operations.billing_reconciliation_cursors set pending_invoice_ids=${page.invoiceIds},pending_cursor=${page.cursor},pending_page=true where account_id=${scope.accountId} and environment=${scope.mode} and lease_token=${leaseToken} and lease_until>now() returning cursor`;
      if (!saved.length) throw new Error("Daily reconciliation lease expired.");
      claim.pendingInvoiceIds = page.invoiceIds;
      claim.pendingCursor = page.cursor;
    }
    for (const id of claim.pendingInvoiceIds) {
      if (now() >= deadline)
        return { processed, pending: true, skipped: false };
      try {
        await reconcileBillingInvoice(
          db,
          provider,
          id,
          Date.now() + Math.max(0, deadline - now()),
        );
        processed++;
      } catch (error) {
        if (!(error instanceof BillingReconciliationError)) throw error;
        await db`insert into operations.billing_exceptions(account_id,environment,object_id,category,operation_key) values(${scope.accountId},${scope.mode},${id},${error.code},${`reconcile:${scope.accountId}:${scope.mode}:${id}`}) on conflict(operation_key) do update set last_seen_at=now(),resolved_at=null`;
      }
      // This checkpoint follows the committed projection (or durable exception), never precedes it.
      const advanced =
        await db`update operations.billing_reconciliation_cursors set pending_invoice_ids=pending_invoice_ids[2:] where account_id=${scope.accountId} and environment=${scope.mode} and lease_token=${leaseToken} and lease_until>now() and pending_invoice_ids[1]=${id} returning cursor`;
      if (!advanced.length)
        throw new Error("Daily reconciliation lease expired.");
    }
    const changed =
      await db`update operations.billing_reconciliation_cursors set cursor=pending_cursor,pending_cursor=null,pending_page=false,next_run_at=case when ${claim.pendingCursor === null} then now()+interval '1 day' else now() end,completed_at=case when ${claim.pendingCursor === null} then now() else completed_at end,lease_token=null,lease_until=null where account_id=${scope.accountId} and environment=${scope.mode} and lease_token=${leaseToken} and lease_until>now() returning cursor`;
    if (!changed.length) throw new Error("Daily reconciliation lease expired.");
    return { processed, pending: claim.pendingCursor !== null, skipped: false };
  } finally {
    await db`update operations.billing_reconciliation_cursors set lease_token=null,lease_until=null where account_id=${scope.accountId} and environment=${scope.mode} and lease_token=${leaseToken}`;
  }
}

async function withinBudget<T>(read: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Late provider reads have no effects: only this awaited result can reach the projection transaction.
    return await Promise.race([
      read,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Reconciliation budget exhausted.")),
          Math.max(0, deadline - Date.now()),
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
