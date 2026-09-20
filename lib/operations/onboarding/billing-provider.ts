import type Stripe from "stripe";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import {
  commandProviderId,
  requireSafeReplay,
} from "../billing/command-repository";
import { createStripeObligation } from "../billing/stripe-obligation";
import { issuedInvoiceSnapshot } from "../billing/invoice-repository";
import { portalUrl } from "../auth/portal-url";
import { requireCurrentEffect } from "./access-provider";
import type { EffectResult, OnboardingLease } from "./types";
const command = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  result: z.unknown(),
  target: z.string(),
});
const contextSchema = z.object({
  schedule: z.object({
    id: z.uuid(),
    organisationId: z.uuid(),
    agreementId: z.uuid(),
    revision: z.number().int().positive(),
    accountId: z.string(),
    mode: z.enum(["test", "live"]),
    key: z.string(),
    owner: z.enum(["invoice", "subscription"]),
    amountPence: z.string().regex(/^\d+$/),
    dueDate: z.iso.date(),
    endDate: z.iso.date().nullable(),
    recurrenceMonths: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(3),
      z.literal(12),
    ]),
    description: z.string(),
    providerReference: z.string().nullable(),
  }),
  customerCommand: command,
  invoiceCommand: command,
  customerId: z.string().nullable(),
  name: z.string().min(1),
  email: z.email(),
});
async function record(
  db: OperationsDb,
  lease: OnboardingLease,
  kind: "customer" | "invoice",
  payload: unknown,
): Promise<void> {
  await db`select operations.onboarding_record_billing(${lease.jobId},${lease.leaseToken},${kind},${JSON.stringify(payload)}::text::jsonb)`;
}
export function createOnboardingBillingProvider(
  db: OperationsDb,
  stripe: Stripe,
  configuration: {
    accountId: string;
    mode: "test" | "live";
    portalOrigin: string;
  },
): (lease: OnboardingLease) => Promise<EffectResult> {
  return async (lease) => {
    if (
      !lease.proposal ||
      new URL(lease.proposal.portalUrl).origin !== configuration.portalOrigin
    )
      return {
        status: "failed",
        code: "configuration",
        retryable: false,
        uncertain: false,
      };
    const selected = lease.snapshot.invoice;
    if (
      selected.accountId !== configuration.accountId ||
      selected.livemode !== (configuration.mode === "live")
    )
      return {
        status: "failed",
        code: "configuration",
        retryable: false,
        uncertain: false,
      };
    const [row] = await db<
      { context: unknown }[]
    >`select operations.onboarding_billing_context(${lease.jobId},${lease.leaseToken},${lease.generation}) as context`;
    const context = contextSchema.parse(row.context);
    if (
      context.schedule.organisationId !== lease.organisationId ||
      context.schedule.agreementId !== lease.agreementId ||
      context.schedule.accountId !== configuration.accountId ||
      context.schedule.mode !== configuration.mode
    )
      throw new Error("Approved billing scope mismatch.");
    await requireCurrentEffect(db, lease);
    if ((await stripe.accounts.retrieve(null)).id !== configuration.accountId)
      return {
        status: "failed",
        code: "configuration",
        retryable: false,
        uncertain: false,
      };
    let customerId =
      context.customerId ?? commandProviderId(context.customerCommand);
    if (!customerId) {
      const matches = await stripe.customers.search({
        query: `metadata['operations_command']:'${context.customerCommand.id}'`,
        limit: 2,
      });
      if (matches.data.length > 1)
        return {
          status: "failed",
          code: "invalid_contract",
          retryable: false,
          uncertain: true,
        };
      customerId = matches.data[0]?.id ?? null;
      if (!customerId) {
        requireSafeReplay(context.customerCommand.createdAt);
        await requireCurrentEffect(db, lease);
        customerId = (
          await stripe.customers.create(
            {
              name: context.name,
              email: context.email,
              metadata: {
                operations_command: context.customerCommand.id,
                operations_organisation: lease.organisationId,
              },
            },
            {
              idempotencyKey: `operations:${context.customerCommand.id}:customer`,
            },
          )
        ).id;
      }
    }
    const customer = await stripe.customers.retrieve(customerId);
    if (
      customer.deleted ||
      customer.livemode !== (configuration.mode === "live")
    )
      throw new Error("Provider customer scope mismatch.");
    await record(db, lease, "customer", { providerId: customerId });
    await requireCurrentEffect(db, lease);
    const result = await createStripeObligation(
      stripe,
      context.schedule,
      customerId,
      context.invoiceCommand,
      () => requireCurrentEffect(db, lease),
    );
    const invoice = result.invoice;
    const snapshot = invoice ? issuedInvoiceSnapshot(invoice) : null;
    await record(db, lease, "invoice", {
      providerId: result.providerId,
      invoice:
        invoice && snapshot
          ? {
              providerInvoiceId: invoice.id,
              number: invoice.number,
              status: invoice.status,
              totalPence: String(invoice.total),
              amountDuePence: String(invoice.amount_due),
              amountOverpaidPence: String(invoice.amount_overpaid),
              amountPaidPence: String(invoice.amount_paid),
              amountRemainingPence: String(invoice.amount_remaining),
              dueDate: snapshot.dueDate,
              snapshot,
            }
          : null,
    });
    // A future subscription schedule is durable, but it is not an issued invoice.
    if (!invoice)
      return {
        status: "failed",
        code: "invalid_contract",
        retryable: false,
        uncertain: false,
      };
    const finalized = invoice.status_transitions.finalized_at;
    if (!finalized)
      return {
        status: "failed",
        code: "unknown_outcome",
        retryable: false,
        uncertain: true,
      };
    return {
      status: "succeeded",
      receipt: {
        providerId: invoice.id,
        acceptedAt: new Date(finalized * 1000).toISOString(),
        url: portalUrl("/billing", configuration.portalOrigin).href,
      },
    };
  };
}
