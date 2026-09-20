import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { signingEnabled } from "@/lib/operations/agreements/signing-commands";
import { listFounderSigning } from "@/lib/operations/agreements/signing-service";
import { SigningReview } from "@/components/operations/signing/signing-review";
import { SigningSummary } from "@/components/operations/signing/signing-summary";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import ui from "@/components/operations/shared/operations-ui.module.css";
import styles from "@/components/operations/agreements/agreements.module.css";
import signingStyles from "@/components/operations/signing/signing.module.css";
import { growthOperationsCutoverEnabled } from "@/lib/operations/auth/release-flags";
import { fssStudioUrl } from "@/lib/operations/auth/studio-url";
export const dynamic = "force-dynamic";
export default async function SigningPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const founder = await requireFounder();
  const { organisationId } = await params;
  if (growthOperationsCutoverEnabled()) {
    redirect(fssStudioUrl(`/admin/clients/${organisationId}/signing`));
  }
  if (!signingEnabled()) notFound();
  let approvals;
  try {
    approvals = await listFounderSigning(
      getOperationsDb(),
      founder,
      organisationId,
      randomUUID(),
    );
  } catch {
    return (
      <section className={ui.errorState} role="alert">
        <h1>Signing could not load</h1>
        <p>Reload to try again.</p>
      </section>
    );
  }
  return (
    <section className={`${styles.page} ${signingStyles.operationsPage}`}>
      <OperationsPageHeader
        context="Operations · Signing"
        title="Ready for agreement."
        description="Review the exact document, approve its signers, and follow each signature."
        action={
          <Link
            href={`/growth/operations/clients/${organisationId}/agreements`}
          >
            Back to agreements
          </Link>
        }
      />
      <SigningSummary approvals={approvals} />
      {approvals.length === 0 && (
        <p className={ui.emptyState}>
          No signing requests yet. Prepare a document from the agreement
          register.
        </p>
      )}
      {approvals.map((approval) => (
        <SigningReview
          key={`${approval.id}-${approval.status}`}
          approval={approval}
          audience="founder"
        />
      ))}
      {approvals.length === 100 && (
        <p>The latest 100 signing requests are shown.</p>
      )}
    </section>
  );
}
