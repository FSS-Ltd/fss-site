import type { OperationsDb } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import { hasPortalCapability } from "../auth/permissions";
import type { BillingScope } from "../billing/domain-types";
import {
  loadBillingCustomer,
  loadBillingCustomerCurrencies,
} from "../billing/customer-repository";
import { loadInvoice } from "../billing/invoice-repository";
import {
  createHostedBillingSession,
  getHostedInvoiceUrl,
  type HostedBillingProvider,
} from "../billing/portal-session";
import type { PortalBillingCommand } from "./billing-handler";

export async function executePortalBillingCommand(
  db: OperationsDb,
  identity: VerifiedPortalIdentity,
  scope: BillingScope,
  command: PortalBillingCommand,
  provider: HostedBillingProvider,
  configurationId: string | undefined,
  returnUrl: string,
  correlationId: string,
): Promise<string> {
  if (command.organisationId !== scope.organisationId)
    throw new PortalAccessDenied();
  const capability =
    command.action === "manage" ? "billing.manage" : "billing.read";
  const stored = await withPortalTransaction(
    db,
    identity,
    scope.organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, capability))
        throw new PortalAccessDenied();
      const invoice =
        command.action === "invoice"
          ? await loadInvoice(tx, scope, command.invoiceId)
          : null;
      if (command.action === "invoice" && !invoice)
        throw new PortalAccessDenied();
      let currency = invoice?.currency;
      if (command.action === "manage") {
        currency = command.currency;
        if (!currency) {
          const currencies = await loadBillingCustomerCurrencies(tx, scope);
          if (currencies.length !== 1) throw new PortalAccessDenied();
          currency = currencies[0];
        }
      }
      if (!currency) throw new PortalAccessDenied();
      const customer = await loadBillingCustomer(tx, scope, currency);
      if (!customer) throw new PortalAccessDenied();
      return { customer, invoice };
    },
  );
  let url: string;
  if (command.action === "manage") {
    if (!configurationId || !/^bpc_[A-Za-z0-9]+$/.test(configurationId))
      throw new Error("Billing management is not configured.");
    url = await createHostedBillingSession(provider, {
      customerId: stored.customer.providerCustomerId,
      configurationId,
      mode: scope.mode,
      returnUrl,
    });
  } else {
    if (!stored.invoice) throw new PortalAccessDenied();
    url = await getHostedInvoiceUrl(provider, {
      customerId: stored.customer.providerCustomerId,
      providerInvoiceId: stored.invoice.providerInvoiceId,
      currency: stored.invoice.currency,
      mode: scope.mode,
    });
  }
  // Membership may have been revoked while the provider request was in flight.
  await withPortalTransaction(
    db,
    identity,
    scope.organisationId,
    correlationId,
    async (_tx, context) => {
      if (!hasPortalCapability(context.role, capability))
        throw new PortalAccessDenied();
    },
  );
  return url;
}
