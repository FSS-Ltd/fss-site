import type { AgreementRegister } from "@/lib/operations/agreements/types";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import type {
  JourneyBillingAccount,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import type { OnboardingWorkspace } from "@/lib/operations/onboarding/workspace-types";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { StaffJourneyBuilder } from "./staff-journey-builder";
import type { JourneyBuilderStage } from "@/lib/operations/onboarding/builder-stage";
import { StaffJourneyDetail } from "./staff-journey-detail";
import { JourneyPreview } from "@/components/operations/onboarding/journey-preview";
import { JourneyTimeline } from "@/components/operations/onboarding/journey-timeline";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-packs";
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
  contacts: Array<{ id: string; name: string; email: string }>;
  billing: JourneyBillingAccount | null;
  builderStage?: JourneyBuilderStage;
  workspace: OnboardingWorkspace;
  welcomePacks: readonly WelcomePack[];
};

export function StaffJourneyWorkspace({
  organisationId,
  register,
  journeys,
  approvals,
  contacts,
  billing,
  builderStage,
  workspace,
  welcomePacks,
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
            href={portalPath(`/portal/admin/clients/${organisationId}`)}
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
          href={portalPath(`/portal/admin/clients/${organisationId}/signing`)}
          variant="secondary"
        >
          Review signing documents
        </PortalActionLink>
        <PortalActionLink
          href={`${portalPath("/portal/admin/welcome/templates")}?organisationId=${encodeURIComponent(organisationId)}`}
          variant="secondary"
        >
          Manage welcome templates
        </PortalActionLink>
      </PortalCard>
      <StaffJourneyBuilder
        agreements={register.agreements.map((agreement) => ({
          id: agreement.id,
          label: agreement.draft.title,
          version: agreement.version,
        }))}
        commandEndpoint={`${apiRoot}/journey`}
        contacts={contacts}
        organisationId={organisationId}
        initialStage={builderStage}
        templates={workspace.templates.map((template) => ({
          id: template.id,
          name: template.name,
          version: template.version,
        }))}
        welcomePacks={welcomePacks.map((pack) => ({
          id: pack.id,
          title: pack.title,
          versions: pack.versions,
        }))}
      />
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
        workspaceDrafts={workspace.journeyDrafts}
        welcomePacks={welcomePacks}
      />
      {journeys.length === 0 ? (
        <Notice tone="info">
          No journeys started. Prepare a welcome to review it before approval.
        </Notice>
      ) : (
        journeys.map((journey) => (
          <section
            key={`${journey.id}-${journey.generation}-${journey.proposalApprovalId}`}
          >
            <StaffJourneyDetail journey={journey} />
            <JourneyTimeline
              organisationId={organisationId}
              journey={journey}
              commandEndpoint={`${apiRoot}/journey`}
              welcomeDownloadUrl={`${apiRoot}/journey/${journey.id}/welcome`}
            />
          </section>
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
