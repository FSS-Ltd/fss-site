import { currencySchema, type Currency } from "../money";
import type Stripe from "stripe";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withAgreementTransaction } from "../agreements/repository";
import type { BillingCustomer, BillingScope } from "./domain-types";
import { validateBillingScope } from "./scope";
import {
  commandProviderId,
  completeBillingCommand,
  reserveBillingCommand,
  requireSafeReplay,
} from "./command-repository";

export async function loadBillingCustomer(
  tx: OperationsTransaction,
  scope: BillingScope,
  currency: Currency = "GBP",
): Promise<BillingCustomer | null> {
  validateBillingScope(scope);
  const [row] = await tx<
    BillingCustomer[]
  >`select id,organisation_id as "organisationId",account_id as "accountId",environment as mode,currency,provider_customer_id as "providerCustomerId" from operations.billing_customers where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and currency=${currency}`;
  return row ?? null;
}
export async function loadBillingCustomerCurrencies(
  tx: OperationsTransaction,
  scope: BillingScope,
): Promise<Currency[]> {
  validateBillingScope(scope);
  const rows = await tx<
    { currency: Currency }[]
  >`select currency from operations.billing_customers where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} order by currency`;
  return rows.map((row) => currencySchema.parse(row.currency));
}
export async function ensureBillingCustomer(
  db: OperationsDb,
  founder: OperationsFounder | null,
  scope: BillingScope,
  stripe: Stripe,
  correlationId: string,
  currency: Currency = "GBP",
): Promise<BillingCustomer> {
  currencySchema.parse(currency);
  const customerTarget =
    currency === "GBP" ? "customer" : `customer:${currency}`;
  const existing = await withAgreementTransaction(db, founder, (tx) =>
    loadBillingCustomer(tx, scope, currency),
  );
  if (existing) return existing;
  const command = await reserveBillingCommand(
    db,
    founder,
    scope,
    customerTarget,
    customerTarget,
    correlationId,
  );
  const [signed] = await withAgreementTransaction(
    db,
    founder,
    (tx) =>
      tx<
        { name: string; email: string }[]
      >`select o.legal_name as name,r.snapshot->>'billingContact' as email from operations.organisations o join operations.signature_evidence e on e.organisation_id=o.id join operations.agreement_revisions r using(organisation_id,agreement_id,revision) where o.id=${scope.organisationId} and r.snapshot->>'currency'=${currency} order by e.created_at,e.agreement_id limit 1`,
  );
  if (!signed)
    throw new Error("Signed agreement required before customer creation.");
  let providerId = commandProviderId(command);
  if (!providerId) {
    // Search is only a recovery hint. An absent match never authorizes replay after expiry.
    const matches = await stripe.customers.search({
      query: `metadata['operations_command']:'${command.id}'`,
      limit: 2,
    });
    if (matches.data.length > 1)
      throw new Error("Multiple provider customers require reconciliation.");
    if (matches.data[0]) providerId = matches.data[0].id;
    else {
      requireSafeReplay(command.createdAt);
      providerId = (
        await stripe.customers.create(
          {
            ...signed,
            metadata: {
              operations_command: command.id,
              operations_organisation: scope.organisationId,
              operations_currency: currency,
            },
          },
          { idempotencyKey: `operations:${command.id}:customer` },
        )
      ).id;
    }
    await completeBillingCommand(db, founder, scope, command.id, {
      providerId,
    });
  }
  return withAgreementTransaction(db, founder, async (tx, actor) => {
    await tx`insert into operations.billing_customers(organisation_id,account_id,environment,currency,provider_customer_id,created_by,correlation_id) values(${scope.organisationId},${scope.accountId},${scope.mode},${currency},${providerId},${actor.actorId},${correlationId}) on conflict(organisation_id,account_id,environment,currency) do nothing`;
    const row = await loadBillingCustomer(tx, scope, currency);
    if (!row || row.providerCustomerId !== providerId)
      throw new Error("Billing customer mapping conflict.");
    return row;
  });
}
