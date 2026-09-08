import type Stripe from "stripe";
import { previewFutureAmendment } from "./future-amendment";
import { z } from "zod";
import { withAgreementTransaction } from "../agreements/repository";
import { parseAgreementDraft, totalLinePence } from "../agreements/validation";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import type { BillingScope } from "./domain-types";
import { loadBillingCustomer } from "./customer-repository";
import { loadBillingSchedule } from "./invoice-repository";
import { stripeAmount } from "./stripe-obligation";

// This operation only previews. Applying a price, cancellation or proration requires a separate approved amendment command.
export async function previewBillingAmendment(
  db: OperationsDb,
  founder: OperationsFounder | null,
  scope: BillingScope,
  input: {
    scheduleId: string;
    agreementId: string;
    revision: number;
    lineNumber: number;
    effectiveAt: string;
  },
  stripe: Stripe,
  correlationId: string,
): Promise<{
  id: string;
  state: "awaiting_founder_approval";
  totalPence: string;
}> {
  z.strictObject({
    scheduleId: z.uuid(),
    agreementId: z.uuid(),
    revision: z.number().int().positive(),
    lineNumber: z.number().int().positive(),
    effectiveAt: z.iso.datetime(),
  }).parse(input);
  z.uuid().parse(correlationId);
  const context = await withAgreementTransaction(db, founder, async (tx) => {
    const schedule = await loadBillingSchedule(tx, scope, input.scheduleId);
    const customer = await loadBillingCustomer(tx, scope);
    const [signed] = await tx<
      { snapshot: unknown }[]
    >`select r.snapshot from operations.agreement_revisions r join operations.signature_evidence e using(organisation_id,agreement_id,revision) where r.organisation_id=${scope.organisationId} and r.agreement_id=${input.agreementId} and r.revision=${input.revision}`;
    if (
      !signed ||
      !customer ||
      schedule.owner !== "subscription" ||
      !schedule.providerReference
    )
      throw new Error(
        "Signed recurring amendment and existing subscription required.",
      );
    const line = parseAgreementDraft(signed.snapshot).lines[
      input.lineNumber - 1
    ];
    if (!line || line.recurrenceMonths === 0)
      throw new Error("Signed recurring amendment line required.");
    if (BigInt(line.taxPence) > BigInt(0))
      throw new Error(
        "Signed tax amounts require founder-reviewed provider tax mapping.",
      );
    return { schedule, customer, line };
  });
  if ((await stripe.accounts.retrieve(null)).id !== scope.accountId)
    throw new Error("Billing provider account mismatch.");
  let reference = context.schedule.providerReference;
  let preview: Stripe.Invoice;
  let change:
    | Awaited<ReturnType<typeof previewFutureAmendment>>["change"]
    | { kind: "subscription_proration" } = { kind: "subscription_proration" };
  let futureProvider: Stripe.SubscriptionSchedule | null = null;
  if (reference?.startsWith("sub_sched_")) {
    const provider = await stripe.subscriptionSchedules.retrieve(reference);
    if (provider.status === "not_started") futureProvider = provider;
    else
      reference =
        typeof provider.subscription === "string"
          ? provider.subscription
          : (provider.subscription?.id ?? null);
  }
  if (futureProvider) {
    const result = await previewFutureAmendment(
      stripe,
      futureProvider,
      context.schedule,
      context.customer.providerCustomerId,
      context.line,
      input.effectiveAt,
    );
    preview = result.invoice;
    change = result.change;
  } else {
    if (!reference)
      throw new Error("An active provider subscription is required.");
    const subscription = await stripe.subscriptions.retrieve(reference);
    if (
      subscription.customer !== context.customer.providerCustomerId ||
      subscription.livemode !== (scope.mode === "live") ||
      subscription.items.data.length !== 1
    )
      throw new Error("Provider subscription context mismatch.");
    const item = subscription.items.data[0];
    const product =
      typeof item.price.product === "string"
        ? item.price.product
        : item.price.product.id;
    preview = await stripe.invoices.createPreview({
      customer: context.customer.providerCustomerId,
      subscription: subscription.id,
      subscription_details: {
        proration_date: amendmentEffectiveTimestamp(input.effectiveAt),
        proration_behavior: "create_prorations",
        items: [
          {
            id: item.id,
            quantity: 1,
            price_data: {
              product,
              currency: "gbp",
              unit_amount: stripeAmount(totalLinePence(context.line)),
              recurring: {
                interval: "month",
                interval_count: context.line.recurrenceMonths,
              },
              tax_behavior: "inclusive",
            },
          },
        ],
      },
    });
  }
  if (preview.currency !== "gbp" || preview.lines.has_more)
    throw new Error("Complete GBP amendment preview required.");
  const snapshot = {
    change,
    providerPreviewId: preview.id,
    totalPence: String(preview.total),
    currency: "GBP",
    lines: preview.lines.data.map((line) => ({
      amountPence: String(line.amount),
      description: line.description,
      period: { start: line.period.start, end: line.period.end },
    })),
  };
  const id = await withAgreementTransaction(db, founder, async (tx, actor) => {
    const [row] = await tx<
      { id: string }[]
    >`insert into operations.billing_amendment_previews(organisation_id,schedule_id,proposed_agreement_id,proposed_revision,effective_at,preview,created_by,correlation_id) values(${scope.organisationId},${input.scheduleId},${input.agreementId},${input.revision},${input.effectiveAt},${tx.json(snapshot)},${actor.actorId},${correlationId}) returning id`;
    return row.id;
  });
  return {
    id,
    state: "awaiting_founder_approval",
    totalPence: snapshot.totalPence,
  };
}

export function amendmentEffectiveTimestamp(effectiveAt: string): number {
  return Math.floor(Date.parse(z.iso.datetime().parse(effectiveAt)) / 1000);
}
