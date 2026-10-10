import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import {
  getPortalDb,
  withPortalTransaction,
} from "@/lib/operations/db/portal-client";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import {
  loadInvoicePage,
  loadInvoices,
} from "@/lib/operations/billing/invoice-repository";
import { loadBillingCustomerCurrencies } from "@/lib/operations/billing/customer-repository";
import { loadBillingSetupStatus } from "@/lib/operations/billing/setup-service";
import { currencySchema } from "@/lib/operations/money";
import { ClientBillingOverview } from "@/components/portal/billing/client-billing-overview";
import {
  nextOpenInvoice,
  toInvoiceSummary,
} from "@/components/portal/billing/presentation";
import { PortalFeatureUnavailable } from "@/components/portal/auth/feature-unavailable";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { CollectionPagination } from "@/components/portal/workspace/collection-pagination";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const context = await getPortalPageContext(params.organisationId);
  if (!context) return <PortalUnavailable />;
  let configuration;
  try {
    configuration = readBillingConfiguration();
  } catch {
    return <PortalUnavailable />;
  }
  if (!configuration.enabled)
    return (
      <PortalFeatureUnavailable
        feature="billing"
        organisationId={context.organisationId}
      />
    );
  let data;
  try {
    const page = parseWorkspacePage(params.page);
    const scope = {
      organisationId: context.organisationId,
      accountId: configuration.accountId,
      mode: configuration.mode,
    };
    data = await withPortalTransaction(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
      async (tx, membership) => {
        if (!hasPortalCapability(membership.role, "billing.read"))
          throw new PortalAccessDenied();
        const [invoices, allInvoices, currencies, organisation] =
          await Promise.all([
            loadInvoicePage(tx, scope, page),
            loadInvoices(tx, scope),
            loadBillingCustomerCurrencies(tx, scope),
            tx<
              { billingCurrency: string }[]
            >`select billing_currency as "billingCurrency" from operations.organisations where id=${context.organisationId}`,
          ]);
        const currency = currencySchema.parse(organisation[0]?.billingCurrency);
        const setup = await loadBillingSetupStatus(tx, scope, currency);
        return {
          allInvoices,
          currencies,
          currency,
          setup,
          invoices,
          canManage: hasPortalCapability(membership.role, "billing.manage"),
        };
      },
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <ClientBillingOverview
      canManage={data.canManage}
      managementCurrencies={data.currencies}
      setupCurrency={data.currency}
      setup={data.setup}
      invoices={data.invoices.items.map(toInvoiceSummary)}
      nextPayment={nextOpenInvoice(data.allInvoices.map(toInvoiceSummary))}
      organisationId={context.organisationId}
      pagination={
        <CollectionPagination
          hasNext={data.invoices.hasNext}
          organisationId={context.organisationId}
          page={data.invoices.page}
          path="/portal/billing"
        />
      }
    />
  );
}
