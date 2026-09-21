import type { AgreementRegister } from "@/lib/operations/agreements/types";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import type {
  JourneyBillingAccount,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import { JourneyPreview } from "@/components/operations/onboarding/journey-preview";
import { JourneyTimeline } from "@/components/operations/onboarding/journey-timeline";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";

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
    <main>
      <PageHeader
        eyebrow="FSS Studio · Welcome journeys"
        title="A deliberate first step."
        description={`${register.organisationName}. Review each recipient, schedule, and recovery decision before any delivery is queued.`}
        action={
          <PortalActionLink
            href={`/admin/clients/${organisationId}`}
            variant="secondary"
          >
            Back to client workspace
          </PortalActionLink>
        }
      />
      <PortalCard title="Draft journeys" tone="accent">
        <p>
          {journeys.length} journey{journeys.length === 1 ? "" : "s"} shown.
        </p>
        <PortalActionLink
          href={`/admin/clients/${organisationId}/signing`}
          variant="secondary"
        >
          Review signing documents
        </PortalActionLink>
      </PortalCard>
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
        <Notice tone="info">
          No journeys started. Prepare a welcome to review it before approval.
        </Notice>
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
        <Notice tone="info">
          The latest 50 journeys, first 50 agreements and first 100 contacts are
          shown.
        </Notice>
      )}
    </main>
  );
}
