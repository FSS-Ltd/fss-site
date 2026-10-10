import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { Currency } from "../money";
import { hasPortalCapability } from "../auth/permissions";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import type { BillingScope } from "./domain-types";
import { loadBillingCustomer } from "./customer-repository";

export type BillingSetupMethod = "card" | "bacs_debit";
export type BillingSetupStatus = Readonly<{
  method: BillingSetupMethod | null;
  status:
    | "not_started"
    | "pending"
    | "active"
    | "pending_mandate"
    | "revoked"
    | "expired"
    | "failed"
    | "cancelled";
  brand: string | null;
  last4: string | null;
  automaticConsent: boolean;
}>;

export async function loadBillingSetupStatus(
  tx: OperationsTransaction,
  scope: BillingScope,
  currency: Currency,
): Promise<BillingSetupStatus> {
  const [preference] = await tx<
    {
      method: BillingSetupMethod;
      status: BillingSetupStatus["status"];
      brand: string | null;
      last4: string | null;
      automaticConsent: boolean;
      expiresMonth: number | null;
      expiresYear: number | null;
      mandateStatus: string | null;
    }[]
  >`
    select method,status,brand,last4,automatic_consent as "automaticConsent",
      expires_month as "expiresMonth",expires_year as "expiresYear",mandate_status as "mandateStatus"
    from operations.portal_billing_payment_preference(
      ${scope.organisationId},${scope.accountId},${scope.mode},${currency}
    )
  `;
  if (preference) {
    const now = new Date();
    const cardExpired =
      preference.method === "card" &&
      preference.expiresYear !== null &&
      preference.expiresMonth !== null &&
      (preference.expiresYear < now.getUTCFullYear() ||
        (preference.expiresYear === now.getUTCFullYear() &&
          preference.expiresMonth < now.getUTCMonth() + 1));
    const status = cardExpired
      ? "expired"
      : preference.method === "bacs_debit"
        ? preference.mandateStatus === "active"
          ? "active"
          : preference.mandateStatus === "inactive"
            ? "revoked"
            : "pending_mandate"
        : preference.status;
    return {
      method: preference.method,
      status,
      brand: preference.brand,
      last4: preference.last4,
      automaticConsent: preference.automaticConsent,
    };
  }
  const [session] = await tx<
    {
      method: BillingSetupMethod;
      status: "pending" | "complete" | "failed" | "cancelled";
    }[]
  >`
    select method,status from operations.billing_setup_sessions
    where organisation_id=${scope.organisationId} and account_id=${scope.accountId}
      and environment=${scope.mode} and currency=${currency}
    order by created_at desc limit 1
  `;
  return {
    method: session?.method ?? null,
    status:
      session?.status === "complete"
        ? "failed"
        : (session?.status ?? "not_started"),
    brand: null,
    last4: null,
    automaticConsent: false,
  };
}

function customerKey(scope: BillingScope, currency: Currency): string {
  return createHash("sha256")
    .update(
      `${scope.organisationId}:${scope.accountId}:${scope.mode}:${currency}`,
    )
    .digest("hex");
}

export async function createBillingSetupSession(
  db: OperationsDb,
  identity: VerifiedPortalIdentity,
  scope: BillingScope,
  stripe: Stripe,
  input: {
    method: BillingSetupMethod;
    currency: Currency;
    automaticConsent: boolean;
  },
  urls: { success: string; cancel: string },
  correlationId: string,
): Promise<string> {
  if (input.method === "bacs_debit" && input.currency !== "GBP")
    throw new PortalAccessDenied();
  const preflight = await withPortalTransaction(
    db,
    identity,
    scope.organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "billing.manage"))
        throw new PortalAccessDenied();
      const [signed] = await tx<
        {
          name: string;
          email: string;
          existingAutomaticSchedule: boolean;
        }[]
      >`
        select name,email,existing_automatic_schedule as "existingAutomaticSchedule"
        from operations.portal_billing_setup_preflight(
          ${scope.organisationId},${scope.accountId},${scope.mode},${input.currency}
        )
      `;
      if (!signed) throw new PortalAccessDenied();
      if (signed.existingAutomaticSchedule)
        throw new Error(
          "Use saved payment management for existing automatic schedules.",
        );
      const customer = await loadBillingCustomer(tx, scope, input.currency);
      return { signed, customer };
    },
  );
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== scope.accountId)
    throw new Error("Billing provider account mismatch.");
  let customerId = preflight.customer?.providerCustomerId;
  if (!customerId) {
    const key = customerKey(scope, input.currency);
    const matches = await stripe.customers.search({
      query: `metadata['operations_setup_key']:'${key}'`,
      limit: 2,
    });
    if (matches.data.length > 1)
      throw new Error("Billing customer requires reconciliation.");
    customerId =
      matches.data[0]?.id ??
      (
        await stripe.customers.create(
          {
            name: preflight.signed.name,
            email: preflight.signed.email,
            metadata: {
              operations_setup_key: key,
              operations_organisation: scope.organisationId,
              operations_currency: input.currency,
            },
          },
          { idempotencyKey: `operations:setup-customer:${key}` },
        )
      ).id;
  }
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || customer.livemode !== (scope.mode === "live"))
    throw new Error("Billing customer context mismatch.");
  if (
    !preflight.customer &&
    (customer.metadata.operations_setup_key !==
      customerKey(scope, input.currency) ||
      customer.metadata.operations_organisation !== scope.organisationId ||
      customer.metadata.operations_currency !== input.currency)
  )
    throw new Error("Billing customer ownership mismatch.");
  const [mapping] = await withPortalTransaction(
    db,
    identity,
    scope.organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "billing.manage"))
        throw new PortalAccessDenied();
      return tx<
        { id: string }[]
      >`select operations.register_billing_setup_customer(
        ${scope.organisationId},${scope.accountId},${scope.mode},${input.currency},${customerId},${correlationId}
      ) as id`;
    },
  );
  const setupId = randomUUID();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "setup",
      customer: customerId,
      currency: input.currency.toLowerCase(),
      payment_method_types: [input.method],
      client_reference_id: setupId,
      metadata: {
        operations_setup: setupId,
        operations_organisation: scope.organisationId,
        operations_currency: input.currency,
      },
      setup_intent_data: {
        metadata: {
          operations_setup: setupId,
          operations_organisation: scope.organisationId,
          operations_currency: input.currency,
        },
      },
      success_url: urls.success,
      cancel_url: urls.cancel,
    },
    { idempotencyKey: `operations:setup-session:${setupId}` },
  );
  if (
    session.customer !== customerId ||
    session.livemode !== (scope.mode === "live") ||
    session.mode !== "setup" ||
    !session.url
  )
    throw new Error("Billing setup session context mismatch.");
  await withPortalTransaction(
    db,
    identity,
    scope.organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "billing.manage"))
        throw new PortalAccessDenied();
      await tx`select operations.register_billing_setup(
        ${setupId},${scope.organisationId},${mapping.id},${scope.accountId},${scope.mode},
        ${input.currency},${input.method},${input.automaticConsent},${session.id},${correlationId}
      )`;
    },
  );
  const url = new URL(session.url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.stripe.com" ||
    url.username ||
    url.password
  )
    throw new Error("Billing setup URL is unavailable.");
  return url.href;
}
