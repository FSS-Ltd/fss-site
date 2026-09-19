import Link from "next/link";
import type { AgreementRegister } from "@/lib/operations/agreements/types";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import type {
  JourneyBillingAccount,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import { JourneyPreview } from "@/components/operations/onboarding/journey-preview";
import { JourneyTimeline } from "@/components/operations/onboarding/journey-timeline";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import ui from "@/components/operations/shared/operations-ui.module.css";
import styles from "@/components/operations/agreements/agreements.module.css";
import layout from "@/components/operations/signing/signing.module.css";

type StaffJourneyWorkspaceProps = {
  organisationId: string;
  register: AgreementRegister;
  journeys: JourneyView[];
  approvals: SigningApproval[];
  contacts: Array<{ name: string; email: string }>;
  billing: JourneyBillingAccount | null;
};

export function StaffJourneyWorkspace({
  organisationId,
  register,
  journeys,
  approvals,
  contacts,
  billing,
}: StaffJourneyWorkspaceProps): React.JSX.Element {
  const apiRoot = `/api/portal/admin/clients/${organisationId}`;

  return (
    <section className={`${styles.page} ${layout.operationsPage}`}>
      <OperationsPageHeader
        context="FSS Studio · Welcome journeys"
        title="A deliberate first step."
        description={`${register.organisationName}. Review each recipient, schedule, and recovery decision before any delivery is queued.`}
        action={
          <Link href={`/admin/clients/${organisationId}`}>
            Back to client workspace
          </Link>
        }
      >
        <Link href={`/admin/clients/${organisationId}/signing`}>
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
        commandEndpoint={`${apiRoot}/journey`}
        signingDownloadBase={`${apiRoot}/signing`}
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
            commandEndpoint={`${apiRoot}/journey`}
            welcomeDownloadUrl={`${apiRoot}/journey/${journey.id}/welcome`}
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
