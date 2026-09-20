import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { signingEnabled } from "@/lib/operations/agreements/signing-commands";
import { listPortalSigning } from "@/lib/operations/agreements/signing-service";
import { SigningReview } from "@/components/operations/signing/signing-review";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "@/components/operations/agreements/agreements.module.css";
import signingStyles from "@/components/operations/signing/signing.module.css";
export const dynamic = "force-dynamic";
export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ organisationId?: string | string[] }>;
}): Promise<React.JSX.Element> {
  if (!signingEnabled()) notFound();
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let approvals;
  try {
    approvals = await listPortalSigning(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <section className={`${styles.page} ${signingStyles.page}`}>
      <header>
        <Link href={portalPath("/portal")}>Your organisations</Link>
        <h1>Your agreements.</h1>
        <p>
          Take a moment to review your terms. Your signature belongs to the
          exact document shown here.
        </p>
      </header>
      {approvals.length === 0 && (
        <article className={styles.card}>
          <h2>Nothing to sign right now</h2>
          <p>
            Agreements that name you as a signer will appear here when they are
            ready.
          </p>
        </article>
      )}
      {approvals.map((approval) => (
        <SigningReview
          key={`${approval.id}-${approval.status}`}
          approval={approval}
          audience="portal"
          email={context.identity.email}
        />
      ))}
      {approvals.length === 100 && (
        <p>The latest 100 signing requests are shown.</p>
      )}
    </section>
  );
}
