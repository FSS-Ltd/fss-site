import type Stripe from "stripe";
import { parseAgreementDraft } from "../agreements/validation";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withAgreementTransaction } from "../agreements/repository";
import type { BillingScope } from "./domain-types";
import { ensureBillingCustomer } from "./customer-repository";
import { loadBillingSchedule, recordInvoice } from "./invoice-repository";
import {
  completeBillingCommand,
  reserveBillingCommand,
} from "./command-repository";
import {
  createStripeObligation,
  type ProviderObligation,
} from "./stripe-obligation";

export async function executeBillingObligation(
  db: OperationsDb,
  founder: OperationsFounder | null,
  scope: BillingScope,
  scheduleId: string,
  commandKey: string,
  stripe: Stripe,
  correlationId: string,
): Promise<ProviderObligation> {
  z.uuid().parse(scheduleId);
  const schedule = await withAgreementTransaction(db, founder, (tx) =>
    loadBillingSchedule(tx, scope, scheduleId),
  );
  await withAgreementTransaction(db, founder, async (tx) => {
    const [row] = await tx<
      { snapshot: unknown }[]
    >`select signed_snapshot as snapshot from operations.billing_schedules where organisation_id=${scope.organisationId} and id=${scheduleId}`;
    if (
      parseAgreementDraft(row.snapshot).lines.some(
        (line) => BigInt(line.taxPence) > BigInt(0),
      )
    )
      throw new Error(
        "Signed tax amounts require founder-reviewed provider tax mapping before issuing invoices.",
      );
  });
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== scope.accountId)
    throw new Error("Billing provider account mismatch.");
  const command = await reserveBillingCommand(
    db,
    founder,
    scope,
    `schedule:${schedule.id}`,
    commandKey,
    correlationId,
  );
  const customer = await ensureBillingCustomer(
    db,
    founder,
    scope,
    stripe,
    correlationId,
    schedule.currency,
  );
  const [collection] = await withAgreementTransaction(
    db,
    founder,
    (tx) =>
      tx<{ paymentMethodId: string | null }[]>`
      select operations.authorised_future_payment_method(${scope.organisationId},${schedule.id}) as "paymentMethodId"
    `,
  );
  const result = await createStripeObligation(
    stripe,
    schedule,
    customer.providerCustomerId,
    command,
    async () => {},
    collection?.paymentMethodId ?? null,
  );
  await withAgreementTransaction(db, founder, async (tx, actor) => {
    const current = await loadBillingSchedule(tx, scope, scheduleId);
    if (
      current.providerReference &&
      current.providerReference !== result.providerId
    )
      throw new Error("Billing obligation already has a collection owner.");
    if (!current.providerReference)
      await tx`update operations.billing_schedules set provider_reference=${result.providerId} where organisation_id=${scope.organisationId} and id=${scheduleId} and provider_reference is null`;
    if (result.invoice && result.invoice.status !== "draft")
      await recordInvoice(
        tx,
        schedule,
        result.invoice,
        actor.actorId,
        correlationId,
      );
  });
  await completeBillingCommand(db, founder, scope, command.id, {
    providerId: result.providerId,
    invoiceId: result.invoice?.id ?? null,
  });
  return result;
}
