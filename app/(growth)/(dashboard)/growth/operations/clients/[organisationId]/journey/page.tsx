import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb } from "@/lib/operations/db/client";
import {
  withAgreementTransaction,
  listAgreementRegister,
} from "@/lib/operations/agreements/repository";
import { listFounderSigning } from "@/lib/operations/agreements/signing-service";
import { listFounderJourneys } from "@/lib/operations/onboarding/queries";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";
import { JourneyPreview } from "@/components/operations/onboarding/journey-preview";
import { JourneyTimeline } from "@/components/operations/onboarding/journey-timeline";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import ui from "@/components/operations/shared/operations-ui.module.css";
import styles from "@/components/operations/agreements/agreements.module.css";
import layout from "@/components/operations/signing/signing.module.css";
export const dynamic = "force-dynamic";
export default async function JourneyPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!onboardingEnabled()) notFound();
  const founder = await requireFounder();
  const { organisationId } = await params;
  const db = getOperationsDb();
  let data;
  try {
    data = await Promise.all([
      listAgreementRegister(db, founder, organisationId),
      listFounderJourneys(db, founder, organisationId),
      listFounderSigning(db, founder, organisationId, randomUUID()),
      withAgreementTransaction(
        db,
        founder,
        (tx) =>
          tx<
            { name: string; email: string }[]
          >`select name,email from operations.contacts where organisation_id=${organisationId} order by name,email limit 100`,
      ),
    ]);
  } catch {
    return (
      <section className={ui.errorState} role="alert">
        <h1>Journeys could not load</h1>
        <p>Refresh to try again.</p>
      </section>
    );
  }
  const [register, journeys, approvals, contacts] = data;
  let billing = null;
  try {
    const config = readBillingConfiguration();
    billing = config.enabled
      ? { accountId: config.accountId, livemode: config.mode === "live" }
      : null;
  } catch {
    billing = null;
  }
  if (!register) notFound();
  return (
    <section className={`${styles.page} ${layout.operationsPage}`}>
      <OperationsPageHeader
        context="Operations · Onboarding"
        title="A clear path to getting started."
        description={`${register.organisationName}. Approve each message, follow the journey and resolve delivery safely.`}
        action={
          <Link
            href={`/growth/operations/clients/${organisationId}/agreements`}
          >
            Back to agreements
          </Link>
        }
      >
        <Link href={`/growth/operations/clients/${organisationId}/signing`}>
          Review signing documents
        </Link>
      </OperationsPageHeader>
      <dl className={ui.metricGrid}>
        <div className={ui.metricCard}>
          <dt>Journeys shown</dt>
          <dd className={styles.count}>{journeys.length}</dd>
        </div>
      </dl>
      <JourneyPreview
        organisationId={organisationId}
        organisationName={register.organisationName}
        agreements={register.agreements}
        contacts={contacts}
        approvals={approvals}
        journeys={journeys}
        billing={billing}
      />
      {journeys.length === 0 ? (
        <p className={ui.emptyState}>
          No journeys started. Prepare a welcome to review it before approval.
        </p>
      ) : (
        journeys.map((journey) => (
          <JourneyTimeline
            key={`${journey.id}-${journey.generation}-${journey.proposalApprovalId}`}
            organisationId={organisationId}
            journey={journey}
          />
        ))
      )}
      {(journeys.length === 50 ||
        contacts.length === 100 ||
        register.nextCursor) && (
        <p>
          The latest 50 journeys, first 50 agreements and first 100 contacts are
          shown.
        </p>
      )}
    </section>
  );
}
