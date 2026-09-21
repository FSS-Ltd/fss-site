import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ClientSigningReview } from "@/components/portal/agreements/client-signing-review";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { PageHeader } from "@/components/portal/ui";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { signingEnabled } from "@/lib/operations/agreements/signing-commands";
import { getPortalSigning } from "@/lib/operations/agreements/signing-service";
import styles from "@/components/portal/agreements/agreements.module.css";

export const dynamic = "force-dynamic";

export default async function ClientAgreementSigningPage({
  params,
  searchParams,
}: {
  params: Promise<{ approvalId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!signingEnabled()) notFound();
  const context = await getPortalPageContext((await searchParams).organisationId);
  if (!context) return <PortalUnavailable />;
  const approvalId = z.uuid().safeParse((await params).approvalId);
  if (!approvalId.success) notFound();

  let approval;
  try {
    approval = await getPortalSigning(
      getPortalDb(),
      context.identity,
      context.organisationId,
      approvalId.data,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  if (!approval) notFound();

  const agreementHref = `${portalPath(`/portal/agreements/${approval.id}`)}?organisationId=${encodeURIComponent(context.organisationId)}`;
  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[
          {
            label: "Agreements",
            href: `${portalPath("/portal/agreements")}?organisationId=${encodeURIComponent(context.organisationId)}`,
          },
          { label: approval.title, href: agreementHref },
          { label: "Review and sign" },
        ]}
        description="Review the exact retained version and confirm your authority before you sign."
        eyebrow="FSS Studio / Agreements"
        title="Review and sign"
      />
      <ClientSigningReview
        approval={approval}
        email={context.identity.email}
        organisationId={context.organisationId}
      />
    </div>
  );
}
