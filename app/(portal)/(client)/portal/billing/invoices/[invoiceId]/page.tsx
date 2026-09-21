import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientInvoiceDetail } from "@/components/portal/billing/client-invoice-detail";
import { toInvoiceDetail } from "@/components/portal/billing/presentation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import { loadBillingCustomer } from "@/lib/operations/billing/customer-repository";
import { loadInvoiceDetail } from "@/lib/operations/billing/invoice-repository";
import {
  getPortalDb,
  withPortalTransaction,
} from "@/lib/operations/db/portal-client";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [routeParameters, query] = await Promise.all([params, searchParams]);
  const invoiceId = z.uuid().safeParse(routeParameters.invoiceId);
  if (!invoiceId.success) notFound();

  const context = await getPortalPageContext(query.organisationId);
  if (!context) return <PortalUnavailable />;

  let configuration;
  try {
    configuration = readBillingConfiguration();
  } catch {
    return <PortalUnavailable />;
  }
  if (!configuration.enabled) return <PortalUnavailable />;

  let data;
  try {
    const scope = {
      accountId: configuration.accountId,
      environment: configuration.mode,
      organisationId: context.organisationId,
    };
    data = await withPortalTransaction(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
      async (tx, membership) => {
        if (!hasPortalCapability(membership.role, "billing.read"))
          throw new PortalAccessDenied();
        const invoice = await loadInvoiceDetail(
          tx,
          {
            accountId: scope.accountId,
            mode: scope.environment,
            organisationId: scope.organisationId,
          },
          invoiceId.data,
        );
        const customer = await loadBillingCustomer(tx, {
          accountId: scope.accountId,
          mode: scope.environment,
          organisationId: scope.organisationId,
        });
        return { canOpenHostedInvoice: Boolean(customer), invoice };
      },
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  if (!data.invoice) notFound();

  return (
    <ClientInvoiceDetail
      canOpenHostedInvoice={data.canOpenHostedInvoice}
      invoice={toInvoiceDetail(data.invoice)}
      organisationId={context.organisationId}
    />
  );
}
