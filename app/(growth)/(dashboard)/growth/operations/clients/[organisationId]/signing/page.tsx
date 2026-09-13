import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb } from "@/lib/operations/db/client";
import { signingEnabled } from "@/lib/operations/agreements/signing-commands";
import { listFounderSigning } from "@/lib/operations/agreements/signing-service";
import { SigningReview } from "@/components/operations/signing/signing-review";
import { SigningSummary } from "@/components/operations/signing/signing-summary";
import styles from "@/components/operations/agreements/agreements.module.css";
import signingStyles from "@/components/operations/signing/signing.module.css";
export const dynamic = "force-dynamic";
export default async function SigningPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!signingEnabled()) notFound();
  const founder = await requireFounder();
  const { organisationId } = await params;
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
      <section role="alert">
        <h1>Signing could not load</h1>
        <p>Reload to try again.</p>
      </section>
    );
  }
  return (
    <section className={`${styles.page} ${signingStyles.page}`}>
      <header>
        <Link href={`/growth/operations/clients/${organisationId}/agreements`}>
          Back to agreements
        </Link>
        <h1>Ready for agreement.</h1>
        <p>
          Review the exact document, approve its signers, and follow each
          signature.
        </p>
      </header>
      <SigningSummary approvals={approvals} />
      {approvals.length === 0 && (
        <p>
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
