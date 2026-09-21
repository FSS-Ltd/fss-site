import { PortalLoginPresentation } from "@/components/portal/auth/login-presentation";
import {
  ClientOverview,
  ClientWorkspaceChooser,
} from "@/components/portal/overview/client-overview";
import { StudioOverview } from "@/components/portal/overview/studio-overview";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PortalButton, PortalField } from "@/components/portal/ui";
import type { ClientOverview as ClientOverviewData } from "@/lib/operations/overview/client-overview";
import type { StudioOverview as StudioOverviewData } from "@/lib/operations/overview/studio-overview";
import {
  ClientBugReportScenario,
  ClientRequestBoardScenario,
  ClientRequestFormScenario,
  ClientRequestReviewScenario,
  StudioDeliveryBoardScenario,
  StudioReviewPackageScenario,
} from "./request-visual-fixtures";
import {
  ClientAgreementDetailScenario,
  ClientAgreementListScenario,
  ClientAgreementSigningScenario,
  StudioAgreementBuilderScenario,
  StudioAgreementListScenario,
  StudioAgreementSignedScenario,
} from "./agreement-visual-fixtures";

export type VisualScenarioName =
  | "client-login"
  | "client-overview"
  | "client-workspace-switcher"
  | "client-shell"
  | "client-request-board"
  | "client-bug-report"
  | "client-request-form"
  | "client-request-review"
  | "client-agreement-list"
  | "client-agreement-detail"
  | "client-agreement-signing"
  | "studio-overview"
  | "studio-shell"
  | "studio-delivery-board"
  | "studio-review-package"
  | "studio-agreement-list"
  | "studio-agreement-builder"
  | "studio-agreement-signed";

export type VisualScenario = Readonly<{
  name: VisualScenarioName;
  content: React.JSX.Element;
}>;

const clientMemberships = [
  {
    displayName: "Northstar Studio",
    organisationId: "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55",
    role: "owner" as const,
  },
  {
    displayName: "Harbour Foundation",
    organisationId: "9d8be1e3-f8d8-4fe1-b15d-01e78c438384",
    role: "viewer" as const,
  },
] as const;

const clientOverview: ClientOverviewData = {
  checklist: {
    agreementSigned: true,
    billingReady: true,
    filesReady: false,
    serviceReady: false,
  },
  notifications: [
    {
      body: "The booking journey is ready for your review.",
      id: "2f7f81f7-f27e-4618-a05c-6d3db8334d04",
      requestId: "c014879c-6301-4ccb-b008-f1d3d5dc433c",
      title: "Review requested",
    },
  ],
  organisationId: clientMemberships[0].organisationId,
  projects: [
    {
      id: "584a707c-7072-4f5a-92d0-5b1447f05db5",
      status: "active",
      summary: "A simpler route from enquiry to booking.",
      targetDate: "2026-09-24",
      title: "Website & booking experience",
    },
  ],
  requests: [
    {
      id: "c014879c-6301-4ccb-b008-f1d3d5dc433c",
      nextAction: "Review the latest delivery.",
      publicSummary: "Your booking flow is ready to review.",
      status: "ready_for_review",
      targetDate: "2026-09-24",
      title: "Review booking flow · v3",
    },
  ],
};

const studioOverview: StudioOverviewData = {
  agreements: [
    {
      agreementCount: 1,
      draftCount: 1,
      organisationId: clientMemberships[1].organisationId,
      organisationName: clientMemberships[1].displayName,
      signedCount: 0,
    },
  ],
  billing: null,
  delivery: {
    blockedCount: 1,
    items: [
      {
        blocked: false,
        id: "c014879c-6301-4ccb-b008-f1d3d5dc433c",
        nextAction: "Review the booking flow with the client.",
        organisationId: clientMemberships[0].organisationId,
        organisationName: clientMemberships[0].displayName,
        priority: "high",
        reviewReminderTarget: "2026-09-15T09:00:00Z",
        status: "ready_for_review",
        title: "Review booking scope",
      },
      {
        blocked: true,
        id: "75ff580f-737d-4ed5-aee6-920738e95ce2",
        nextAction: "Confirm the final agreement and shared assets.",
        organisationId: clientMemberships[1].organisationId,
        organisationName: clientMemberships[1].displayName,
        priority: "normal",
        reviewReminderTarget: null,
        status: "planned",
        title: "Membership portal kickoff",
      },
    ],
    reviewCount: 1,
  },
  journeys: [
    {
      activeCount: 1,
      journeyCount: 1,
      organisationId: clientMemberships[0].organisationId,
      organisationName: clientMemberships[0].displayName,
      recoveryCount: 1,
    },
  ],
  signing: [
    {
      approvalId: "7a3a4792-6c14-4e92-8f80-0ab41b8f6395",
      organisationId: clientMemberships[1].organisationId,
      organisationName: clientMemberships[1].displayName,
      status: "prepared",
      title: "Membership portal agreement",
    },
  ],
};

function ClientLoginScenario(): React.JSX.Element {
  return (
    <PortalLoginPresentation invitationMessage="Your workspace invitation is ready">
      <form>
        <PortalField label="Work email" required>
          <input
            autoComplete="email"
            id="visual-email"
            name="email"
            type="email"
          />
        </PortalField>
        <PortalButton type="submit">Continue</PortalButton>
      </form>
    </PortalLoginPresentation>
  );
}

function ClientOverviewScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={[clientMemberships[0]]}>
      <ClientOverview
        canCreateRequest
        overview={clientOverview}
        workspaceName={clientMemberships[0].displayName}
      />
    </ClientShell>
  );
}

function ClientWorkspaceSwitcherScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={clientMemberships}>
      <ClientWorkspaceChooser memberships={clientMemberships} />
    </ClientShell>
  );
}

function ClientShellScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={[clientMemberships[0]]}>
      <p>Client shell fixture</p>
    </ClientShell>
  );
}

function StudioOverviewScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <StudioOverview
        asOf={new Date("2026-09-20T12:00:00Z")}
        overview={studioOverview}
      />
    </StudioShell>
  );
}

function StudioShellScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <p>Studio shell fixture</p>
    </StudioShell>
  );
}

const scenarios: Record<VisualScenarioName, VisualScenario> = {
  "client-login": { name: "client-login", content: <ClientLoginScenario /> },
  "client-overview": {
    name: "client-overview",
    content: <ClientOverviewScenario />,
  },
  "client-workspace-switcher": {
    name: "client-workspace-switcher",
    content: <ClientWorkspaceSwitcherScenario />,
  },
  "client-shell": { name: "client-shell", content: <ClientShellScenario /> },
  "client-request-board": {
    name: "client-request-board",
    content: <ClientRequestBoardScenario />,
  },
  "client-bug-report": {
    name: "client-bug-report",
    content: <ClientBugReportScenario />,
  },
  "client-request-form": {
    name: "client-request-form",
    content: <ClientRequestFormScenario />,
  },
  "client-request-review": {
    name: "client-request-review",
    content: <ClientRequestReviewScenario />,
  },
  "client-agreement-list": {
    name: "client-agreement-list",
    content: <ClientAgreementListScenario />,
  },
  "client-agreement-detail": {
    name: "client-agreement-detail",
    content: <ClientAgreementDetailScenario />,
  },
  "client-agreement-signing": {
    name: "client-agreement-signing",
    content: <ClientAgreementSigningScenario />,
  },
  "studio-overview": {
    name: "studio-overview",
    content: <StudioOverviewScenario />,
  },
  "studio-shell": { name: "studio-shell", content: <StudioShellScenario /> },
  "studio-delivery-board": {
    name: "studio-delivery-board",
    content: <StudioDeliveryBoardScenario />,
  },
  "studio-review-package": {
    name: "studio-review-package",
    content: <StudioReviewPackageScenario />,
  },
  "studio-agreement-list": {
    name: "studio-agreement-list",
    content: <StudioAgreementListScenario />,
  },
  "studio-agreement-builder": {
    name: "studio-agreement-builder",
    content: <StudioAgreementBuilderScenario />,
  },
  "studio-agreement-signed": {
    name: "studio-agreement-signed",
    content: <StudioAgreementSignedScenario />,
  },
};

export function resolveVisualScenario(
  name: string,
  enabled: boolean,
  nodeEnvironment: string | undefined,
): VisualScenario | null {
  if (!enabled || nodeEnvironment === "production") return null;
  return name in scenarios ? scenarios[name as VisualScenarioName] : null;
}
