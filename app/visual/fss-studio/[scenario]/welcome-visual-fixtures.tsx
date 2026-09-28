import { ClientOnboardingTaskDetail } from "@/components/portal/onboarding/client-onboarding-task";
import { ClientOnboardingWorkspaceView } from "@/components/portal/onboarding/client-onboarding-workspace";
import { JourneyTemplateEditor } from "@/components/portal/onboarding/journey-template-editor";
import { StaffJourneyBuilder } from "@/components/portal/onboarding/staff-journey-builder";
import { StaffJourneyDetail } from "@/components/portal/onboarding/staff-journey-detail";
import { StaffJourneyOverview } from "@/components/portal/onboarding/staff-journey-overview";
import { JourneyTimeline } from "@/components/operations/onboarding/journey-timeline";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import {
  Notice,
  PageHeader,
  PortalButton,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import type {
  ClientOnboardingTask,
  ClientOnboardingWorkspace,
} from "@/lib/operations/onboarding/client-workspace";
import type { JourneyView } from "@/lib/operations/onboarding/command-types";
import type { OnboardingWorkspaceTemplateDraft } from "@/lib/operations/onboarding/workspace-types";
import type { PortalWorkspaceDocument } from "@/lib/operations/workspaces/types";

const organisationId = "18e66a5c-2907-46a1-a8ae-813dc2b1c52a";
const templateId = "6b7f35a6-2e39-4b28-9e22-7c093cd8a786";
const templateVersionId = "0e5d47c9-44b3-413c-9a4d-76ed2ee543b5";

const clientMemberships = [
  {
    displayName: "Northstar Studio",
    organisationId,
    role: "owner" as const,
  },
];

const profileTask: ClientOnboardingTask = {
  action: { type: "complete_profile" },
  completionDetail: null,
  dueAt: null,
  id: "251ca610-fc39-4d49-9e7d-436ef17d59ba",
  instructions: "Tell us the best details for your delivery team.",
  kind: "profile",
  ownerLabel: "Assigned to owner.",
  required: true,
  state: "available",
  templateVersionId,
  title: "Tell us about your team",
};

const assetTask: ClientOnboardingTask = {
  action: { type: "attach_cleared_documents" },
  completionDetail: null,
  dueAt: null,
  id: "933ce88b-cf83-4bd4-8d6c-d2e5ee799317",
  instructions:
    "Choose the cleared brand files we should use to start the work.",
  kind: "upload",
  ownerLabel: "Assigned to owner.",
  required: true,
  state: "available",
  templateVersionId,
  title: "Bring your brand with you",
};

const bookingTask: ClientOnboardingTask = {
  action: {
    href: "https://booking.example.test/kickoff",
    type: "open_booking",
  },
  completionDetail: null,
  dueAt: null,
  id: "8fb525a5-8700-4633-9cdc-409c4eb53a1f",
  instructions: "Choose a London time for the project kickoff.",
  kind: "booking",
  ownerLabel: "Assigned to owner.",
  required: true,
  state: "available",
  templateVersionId,
  title: "Let’s plan the kickoff",
};

const completedTask: ClientOnboardingTask = {
  ...profileTask,
  action: { type: "none" },
  completionDetail: "FSS has recorded your project contact details.",
  state: "complete",
};

const clientWorkspace: ClientOnboardingWorkspace = {
  checklist: {
    agreementSigned: true,
    billingReady: true,
    filesReady: false,
    serviceReady: false,
  },
  requiredTasksComplete: false,
  tasks: [
    completedTask,
    {
      ...assetTask,
      instructions: "Upload your approved logo, brand guide and final copy.",
      title: "Share brand assets",
    },
    { ...bookingTask, action: { type: "none" }, state: "blocked" },
  ],
};

const completedWorkspace: ClientOnboardingWorkspace = {
  ...clientWorkspace,
  requiredTasksComplete: true,
  tasks: [
    completedTask,
    {
      ...assetTask,
      action: { type: "none" },
      completionDetail: "Cleared brand assets are attached to this task.",
      state: "complete",
    },
    {
      ...bookingTask,
      action: { type: "none" },
      completionDetail: "FSS confirmed your kickoff session.",
      state: "complete",
    },
  ],
};

const documents: readonly PortalWorkspaceDocument[] = [
  {
    filename: "northstar-brand-guide.pdf",
    id: "420e42f4-e248-4e48-bbe3-e4341e5ad1cc",
    kind: "file",
    mimeType: "application/pdf",
    projectId: "2bcc71eb-a10e-4f2b-8b82-b88db3c0103f",
    projectTitle: "Website & booking experience",
    sizeBytes: 83_200,
    title: "Northstar brand guide",
  },
];

export const visualChecklistTaskId = "eec4fc3d-c1fb-44f1-ac64-a6494b6b38d5";

const checklistTask = {
  bookingUrl: null,
  dependsOnTaskId: null,
  dueRule: "activation" as const,
  evidenceRule: "profile_saved" as const,
  id: visualChecklistTaskId,
  instructions:
    "Confirm the details FSS should use for the delivery workspace.",
  kind: "profile" as const,
  ownerRole: "owner" as const,
  required: true,
  title: "Confirm your details",
};

const templateDrafts: readonly OnboardingWorkspaceTemplateDraft[] = [
  {
    draftVersion: 2,
    id: templateId,
    name: "Project welcome",
    publishedVersion: 1,
    tasks: [
      checklistTask,
      {
        bookingUrl: null,
        dependsOnTaskId: checklistTask.id,
        dueRule: "previous_task",
        evidenceRule: "cleared_documents",
        id: "f2ee889b-7438-47fe-ac01-9f7e3c75b038",
        instructions: "Upload your approved logo, brand guide and final copy.",
        kind: "upload",
        ownerRole: "owner",
        required: true,
        title: "Share brand assets",
      },
    ],
  },
];

const activeJourney: JourneyView = {
  agreementId: "fbb253c0-1632-43c1-bc5a-d5998df765cc",
  agreementTitle: "Northstar’s welcome journey",
  currentProposal: true,
  failureCode: null,
  generation: 1,
  id: "a414b91d-87bf-443f-9837-ef9bc150192e",
  jobs: [
    {
      acceptedAt: "2026-09-20T10:15:00.000Z",
      attempts: 1,
      dueAt: "2026-09-20T10:00:00.000Z",
      failureCode: null,
      id: "abf8a75e-da97-44cb-97cd-ca608a1631f2",
      providerId: "email_approved_01",
      recipient: "alex@northstar.example.test",
      state: "succeeded",
      step: "welcome",
      uncertain: false,
    },
  ],
  postSignatureDueAt: null,
  proposal: null,
  proposalApprovalId: null,
  proposalDueAt: null,
  signatureAt: null,
  state: "active",
  welcome: {
    accessibleHtml: "<p>Welcome</p>",
    content: {
      contactFirstName: "Alex",
      from: "hello@fss.example.test",
      organisationName: "Faithful Software Solutions",
      outcomeSummary: "A focused website and booking experience.",
      pages: [],
      primaryGoal: "Make booking clear and simple.",
      replyTo: "hello@fss.example.test",
      senderName: "Jean-Fidele",
    },
    invoice: {
      accountId: "acct_fixture",
      livemode: false,
      obligationKey: "installment:1",
    },
    pdfHash: "fixture-hash",
    recipient: "alex@northstar.example.test",
    thankYou: {
      intro: "Your welcome is ready.",
      nextStep: "We will begin delivery after the recorded prerequisites.",
      requiredAction: "Complete your launch checklist.",
      subject: "Your FSS agreement and next steps",
    },
    welcome: {
      from: "hello@fss.example.test",
      html: "<p>Welcome</p>",
      replyTo: "hello@fss.example.test",
      subject: "Welcome to FSS",
      text: "Welcome",
      to: "alex@northstar.example.test",
    },
  },
};

const recoveryJourney: JourneyView = {
  ...activeJourney,
  failureCode: "unknown_outcome",
  jobs: [
    {
      ...activeJourney.jobs[0],
      acceptedAt: null,
      failureCode: "unknown_outcome",
      providerId: null,
      state: "unknown_outcome",
      uncertain: true,
    },
  ],
  state: "blocked",
};

function ClientFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClientShell memberships={clientMemberships}>{children}</ClientShell>;
}

function StudioFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <StudioShell>{children}</StudioShell>;
}

export function ClientGettingStartedScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientOnboardingWorkspaceView
        organisationId={organisationId}
        workspace={clientWorkspace}
      />
    </ClientFrame>
  );
}

export function ClientOnboardingProfileScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientOnboardingTaskDetail
        organisationId={organisationId}
        task={profileTask}
      />
    </ClientFrame>
  );
}

export function ClientOnboardingAssetsScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientOnboardingTaskDetail
        documents={documents}
        organisationId={organisationId}
        task={assetTask}
      />
    </ClientFrame>
  );
}

export function ClientOnboardingBookingScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientOnboardingTaskDetail
        organisationId={organisationId}
        task={bookingTask}
      />
    </ClientFrame>
  );
}

export function ClientOnboardingCompleteScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientOnboardingWorkspaceView
        organisationId={organisationId}
        workspace={completedWorkspace}
      />
    </ClientFrame>
  );
}

export function StudioWelcomeJourneysScenario(): React.JSX.Element {
  return (
    <StudioFrame>
      <StaffJourneyOverview
        journeys={[
          {
            activeCount: 1,
            journeyCount: 2,
            organisationId,
            organisationName: "Northstar Studio",
            recoveryCount: 1,
          },
        ]}
      />
    </StudioFrame>
  );
}

export function StudioWelcomeBuilderScenario({
  stage,
}: Readonly<{
  stage: "access" | "content" | "schedule" | "setup";
}>): React.JSX.Element {
  return (
    <StudioFrame>
      <main>
        <PageHeader
          description="Prepare a reviewed welcome journey for Northstar Studio."
          eyebrow="FSS Studio · Welcome journeys"
          title={
            stage === "content"
              ? "Make the welcome personal"
              : stage === "access"
                ? "People, signing and access"
                : stage === "schedule"
                  ? "Sequence the next steps"
                  : "Prepare a warm welcome"
          }
        />
        <StaffJourneyBuilder
          agreements={[
            {
              id: activeJourney.agreementId,
              label: "Website & booking experience",
              version: 3,
            },
          ]}
          commandEndpoint="/visual/no-command"
          contacts={[
            {
              email: "alex@northstar.example.test",
              id: "5a4c051b-88ec-4d00-a634-ea16da5d6c17",
              name: "Alex Morgan",
            },
          ]}
          organisationId="5c90c28c-f1a4-4e9e-a4eb-a833af085735"
          initialStage={stage}
          templates={[
            { id: templateVersionId, name: "Project welcome", version: 1 },
          ]}
          welcomePacks={[]}
        />
      </main>
    </StudioFrame>
  );
}

export function StudioWelcomePreflightScenario(): React.JSX.Element {
  return (
    <StudioFrame>
      <main>
        <PageHeader
          description="The reviewed welcome can only start after every server-owned check passes."
          eyebrow="FSS Studio · Welcome journeys"
          title="Ready when you are."
        />
        <PortalCard title="Preflight" tone="accent">
          <ul>
            <li>
              <StatusBadge status="success">
                Current agreement ready.
              </StatusBadge>
            </li>
            <li>
              <StatusBadge status="success">
                Recipient and role ready.
              </StatusBadge>
            </li>
            <li>
              <StatusBadge status="success">
                Approved checklist version ready.
              </StatusBadge>
            </li>
          </ul>
          <Notice tone="info">
            The exact PDF, recipient and checklist snapshot are reviewed before
            the journey is started.
          </Notice>
          <PortalButton disabled type="button">
            Start approved welcome after review
          </PortalButton>
        </PortalCard>
      </main>
    </StudioFrame>
  );
}

export function StudioWelcomeActiveScenario(): React.JSX.Element {
  return (
    <StudioFrame>
      <main>
        <PageHeader
          description="View each retained delivery step and its verified acceptance."
          eyebrow="FSS Studio · Welcome journeys"
          title="Northstar’s welcome journey"
        />
        <StaffJourneyDetail journey={activeJourney} />
        <JourneyTimeline
          commandEndpoint="/visual/no-command"
          journey={activeJourney}
          organisationId={organisationId}
          welcomeDownloadUrl="/visual/approved-welcome.pdf"
        />
      </main>
    </StudioFrame>
  );
}

export function StudioWelcomeRecoveryScenario(): React.JSX.Element {
  return (
    <StudioFrame>
      <main>
        <PageHeader
          description="Resolve the original delivery safely before any replacement action."
          eyebrow="FSS Studio · Welcome journeys"
          title="Resolve delivery safely"
        />
        <StaffJourneyDetail journey={recoveryJourney} />
        <JourneyTimeline
          commandEndpoint="/visual/no-command"
          journey={recoveryJourney}
          organisationId={organisationId}
          welcomeDownloadUrl="/visual/approved-welcome.pdf"
        />
        <Notice tone="warning">
          Retry only a confirmed failure. An unknown outcome requires provider
          reconciliation first.
        </Notice>
      </main>
    </StudioFrame>
  );
}

export function StudioWelcomeTemplatesScenario({
  taskId,
  title,
}: Readonly<{
  taskId?: string;
  title: string;
}>): React.JSX.Element {
  return (
    <StudioFrame>
      <main>
        <PageHeader
          description="Draft a client checklist, then publish an immutable version for future welcome journeys."
          eyebrow="FSS Studio · Welcome journeys"
          title={title}
        />
        <JourneyTemplateEditor
          commandEndpoint="/visual/no-command"
          initialTaskId={taskId}
          initialTemplateId={templateId}
          templates={templateDrafts}
        />
      </main>
    </StudioFrame>
  );
}
