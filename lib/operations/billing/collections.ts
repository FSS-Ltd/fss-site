import type { OperationsTransaction } from "../db/client";
export const BILLING_COLLECTIONS_OWNER = "stripe";
export type CollectionsState = {
  status: string;
  amountRemainingPence: string;
  processing: boolean;
  disputed: boolean;
  held: boolean;
  mandateState?: string | null;
  overdueDays: number;
  method: string;
  failureCode: string | null;
};
export type CollectionsDecision =
  | "overdue_review"
  | "provider_retry_review"
  | "new_mandate_required"
  | "payment_method_required";
/** Stripe owns reminders and retries. These decisions only create internal review items. */
export function collectionsDecision(
  state: CollectionsState,
): CollectionsDecision | null {
  if (
    state.status !== "open" ||
    BigInt(state.amountRemainingPence) === BigInt(0) ||
    state.processing ||
    state.disputed ||
    state.held
  )
    return null;
  if (state.method === "bacs_debit" && state.mandateState === "pending")
    return null;
  if (state.method === "bacs_debit" && state.mandateState === "inactive")
    return "new_mandate_required";
  if (state.method === "bacs_debit" && state.failureCode)
    return state.failureCode === "insufficient_funds" &&
      state.mandateState === "active"
      ? "provider_retry_review"
      : "new_mandate_required";
  if (
    state.method === "card" &&
    [
      "authentication_required",
      "lost_card",
      "stolen_card",
      "revocation_of_authorization",
      "transaction_not_allowed",
    ].includes(state.failureCode ?? "")
  )
    return "payment_method_required";
  return state.overdueDays >= 14 ? "overdue_review" : null;
}
export async function refreshCollectionsReview(
  tx: OperationsTransaction,
  invoiceId: string,
): Promise<void> {
  const [invoice] = await tx<
    (CollectionsState & {
      organisationId: string;
      accountId: string;
      mode: string;
      providerId: string;
    })[]
  >`
    select i.organisation_id as "organisationId", i.account_id as "accountId", i.environment as mode,i.provider_invoice_id as "providerId",i.status,i.amount_remaining_pence::text as "amountRemainingPence",
    exists(select 1 from operations.payment_allocations a join operations.payments p on p.id=a.payment_id where a.invoice_id=i.id and p.state='processing') as processing,
    exists(select 1 from operations.payment_allocations a join operations.payment_disputes d on d.payment_id=a.payment_id where a.invoice_id=i.id and d.status not in ('won','lost','warning_closed')) as disputed,
    exists(select 1 from operations.billing_collection_holds h where h.invoice_id=i.id and h.released_at is null) as held,
    (select m.status from operations.payment_allocations a join operations.payments p on p.id=a.payment_id left join operations.mandate_projections m on m.organisation_id=p.organisation_id and m.account_id=p.account_id and m.environment=p.environment and m.provider_mandate_id=p.provider_mandate_id where a.invoice_id=i.id order by p.provider_created_at desc,p.id limit 1) as "mandateState",
    coalesce(current_date-i.due_date,0) as "overdueDays",
    coalesce((select p.method from operations.payment_allocations a join operations.payments p on p.id=a.payment_id where a.invoice_id=i.id order by p.provider_created_at desc,p.id limit 1),'other') as method,
    (select p.failure_code from operations.payment_allocations a join operations.payments p on p.id=a.payment_id where a.invoice_id=i.id order by p.provider_created_at desc,p.id limit 1) as "failureCode"
    from operations.invoices i where i.id=${invoiceId} for update`;
  if (!invoice) throw new Error("Invoice not found.");
  const decision = collectionsDecision(invoice);
  await tx`update operations.billing_exceptions set resolved_at=now() where account_id=${invoice.accountId} and environment=${invoice.mode} and object_id=${invoice.providerId} and category in ('overdue_review','provider_retry_review','new_mandate_required','payment_method_required') and resolved_at is null`;
  if (decision)
    await tx`insert into operations.billing_exceptions(organisation_id,account_id,environment,object_id,category,operation_key) values(${invoice.organisationId},${invoice.accountId},${invoice.mode},${invoice.providerId},${decision},${`collections:${invoiceId}:${decision}`}) on conflict(operation_key) do update set resolved_at=null,last_seen_at=now()`;
}
