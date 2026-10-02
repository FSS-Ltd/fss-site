import {
  ClientCommercialScenario,
  StaffCommercialScenario,
} from "./commercial-visual-fixtures";
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
  ClientRequestCompleteScenario,
  ClientRequestConflictScenario,
  ClientRequestDetailScenario,
  ClientRequestEmptyScenario,
  ClientRequestFeedbackScenario,
  ClientRequestLoadingScenario,
  ClientRequestNoProjectScenario,
  ClientReviewRequestedEmailScenario,
  ClientWorkCompletedEmailScenario,
  StudioRequestCreateScenario,
  StudioRequestDetailScenario,
  StudioRequestMoveScenario,
  StudioRequestScopeScenario,
} from "./request-completion-visual-fixtures";
import {
  ClientAgreementDetailScenario,
  ClientAgreementListScenario,
  ClientAgreementSignedScenario,
  ClientAgreementSigningScenario,
  StudioEngagementProvenanceScenario,
  StudioAgreementBuilderScenario,
  StudioAgreementListScenario,
  StudioAgreementSignedScenario,
  StudioSignatureEvidenceScenario,
  StudioSigningStatusScenario,
} from "./agreement-visual-fixtures";
import {
  ClientGettingStartedScenario,
  ClientOnboardingAssetsScenario,
  ClientOnboardingBookingScenario,
  ClientOnboardingCompleteScenario,
  ClientOnboardingProfileScenario,
  StudioWelcomeActiveScenario,
  StudioWelcomeBuilderScenario,
  StudioWelcomeJourneysScenario,
  StudioWelcomePreflightScenario,
  StudioWelcomeRecoveryScenario,
  StudioWelcomeTemplatesScenario,
  visualChecklistTaskId,
} from "./welcome-visual-fixtures";
import {
  ClientBillingScenario,
  ClientDocumentDetailScenario,
  ClientDocumentQuarantineScenario,
  ClientDocumentsScenario,
  ClientHelpScenario,
  ClientInvitationExpiredScenario,
  ClientInvoiceScenario,
  ClientNotificationsScenario,
  ClientPreferencesScenario,
  ClientProjectDetailScenario,
  ClientProjectsScenario,
  ClientServiceEnquiryScenario,
  ClientServicesScenario,
  ClientTeamScenario,
  ClientUnavailableScenario,
  ClientViewerAccessScenario,
} from "./client-support-visual-fixtures";
import {
  StudioBillingOperationsScenario,
  StudioClientCreateScenario,
  StudioClientDetailScenario,
  StudioClientsScenario,
  StudioJourneyBlockedScenario,
  StudioNotificationDeliveryScenario,
  StudioPortalAccessScenario,
  StudioProjectEditScenario,
  StudioSettingsScenario,
} from "./studio-workspace-visual-fixtures";
import {
  ClientOrganisationOnboardingScenario,
  StudioClientAgreementRegisterScenario,
  StudioClientRequestRegisterScenario,
  StudioClientSigningRegisterScenario,
  StudioProjectCreateScenario,
  StudioProjectDocumentsScenario,
  StudioProjectRegisterScenario,
} from "./active-route-visual-fixtures";

export type VisualScenarioName =
  | "client-commercial-offer"
  | "staff-commercial-offer"
  | "client-login"
  | "client-overview"
  | "client-workspace-switcher"
  | "client-shell"
  | "client-request-board"
  | "client-bug-report"
  | "client-request-form"
  | "client-request-review"
  | "client-request-detail"
  | "client-request-feedback"
  | "client-request-complete"
  | "client-request-empty"
  | "client-request-no-project"
  | "client-request-conflict"
  | "client-request-loading"
  | "client-review-requested-email"
  | "client-work-completed-email"
  | "client-agreement-list"
  | "client-agreement-detail"
  | "client-agreement-signed"
  | "client-agreement-signing"
  | "client-getting-started"
  | "client-onboarding-profile"
  | "client-onboarding-assets"
  | "client-onboarding-booking"
  | "client-onboarding-complete"
  | "client-projects"
  | "client-project-detail"
  | "client-documents"
  | "client-document-detail"
  | "client-billing"
  | "client-invoice"
  | "client-services"
  | "client-service-enquiry"
  | "client-notifications"
  | "client-help"
  | "client-preferences"
  | "client-team"
  | "client-organisation-onboarding"
  | "client-unavailable"
  | "client-invitation-expired"
  | "client-document-quarantine"
  | "client-viewer-access"
  | "studio-overview"
  | "studio-shell"
  | "studio-delivery-board"
  | "studio-review-package"
  | "studio-request-detail"
  | "studio-request-scope"
  | "studio-request-create"
  | "studio-request-move"
  | "studio-agreement-list"
  | "studio-agreement-builder"
  | "studio-agreement-builder-scope"
  | "studio-agreement-builder-fees"
  | "studio-agreement-builder-people"
  | "studio-agreement-builder-document"
  | "studio-agreement-builder-review"
  | "studio-agreement-no-engagement"
  | "studio-agreement-signed"
  | "studio-engagement-provenance"
  | "studio-signature-evidence"
  | "studio-signing-status"
  | "studio-welcome-journeys"
  | "studio-welcome-builder"
  | "studio-welcome-content"
  | "studio-welcome-access"
  | "studio-welcome-schedule"
  | "studio-welcome-without-billing"
  | "studio-welcome-preflight"
  | "studio-welcome-active"
  | "studio-welcome-recovery"
  | "studio-welcome-templates"
  | "studio-checklist-editor"
  | "studio-checklist-task-editor"
  | "studio-clients"
  | "studio-client-detail"
  | "studio-client-create"
  | "studio-billing-operations"
  | "studio-portal-access"
  | "studio-notification-delivery"
  | "studio-settings"
  | "studio-project-edit"
  | "studio-journey-blocked"
  | "studio-client-agreements"
  | "studio-client-requests"
  | "studio-client-signing"
  | "studio-projects"
  | "studio-project-create"
  | "studio-project-documents";

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
  "client-commercial-offer": {
    name: "client-commercial-offer",
    content: <ClientCommercialScenario />,
  },
  "staff-commercial-offer": {
    name: "staff-commercial-offer",
    content: <StaffCommercialScenario />,
  },
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
  "client-request-detail": {
    name: "client-request-detail",
    content: <ClientRequestDetailScenario />,
  },
  "client-request-feedback": {
    name: "client-request-feedback",
    content: <ClientRequestFeedbackScenario />,
  },
  "client-request-complete": {
    name: "client-request-complete",
    content: <ClientRequestCompleteScenario />,
  },
  "client-request-empty": {
    name: "client-request-empty",
    content: <ClientRequestEmptyScenario />,
  },
  "client-request-no-project": {
    name: "client-request-no-project",
    content: <ClientRequestNoProjectScenario />,
  },
  "client-request-conflict": {
    name: "client-request-conflict",
    content: <ClientRequestConflictScenario />,
  },
  "client-request-loading": {
    name: "client-request-loading",
    content: <ClientRequestLoadingScenario />,
  },
  "client-review-requested-email": {
    name: "client-review-requested-email",
    content: <ClientReviewRequestedEmailScenario />,
  },
  "client-work-completed-email": {
    name: "client-work-completed-email",
    content: <ClientWorkCompletedEmailScenario />,
  },
  "client-agreement-list": {
    name: "client-agreement-list",
    content: <ClientAgreementListScenario />,
  },
  "client-agreement-detail": {
    name: "client-agreement-detail",
    content: <ClientAgreementDetailScenario />,
  },
  "client-agreement-signed": {
    name: "client-agreement-signed",
    content: <ClientAgreementSignedScenario />,
  },
  "client-agreement-signing": {
    name: "client-agreement-signing",
    content: <ClientAgreementSigningScenario />,
  },
  "client-getting-started": {
    name: "client-getting-started",
    content: <ClientGettingStartedScenario />,
  },
  "client-onboarding-profile": {
    name: "client-onboarding-profile",
    content: <ClientOnboardingProfileScenario />,
  },
  "client-onboarding-assets": {
    name: "client-onboarding-assets",
    content: <ClientOnboardingAssetsScenario />,
  },
  "client-onboarding-booking": {
    name: "client-onboarding-booking",
    content: <ClientOnboardingBookingScenario />,
  },
  "client-onboarding-complete": {
    name: "client-onboarding-complete",
    content: <ClientOnboardingCompleteScenario />,
  },
  "client-projects": {
    name: "client-projects",
    content: <ClientProjectsScenario />,
  },
  "client-project-detail": {
    name: "client-project-detail",
    content: <ClientProjectDetailScenario />,
  },
  "client-documents": {
    name: "client-documents",
    content: <ClientDocumentsScenario />,
  },
  "client-document-detail": {
    name: "client-document-detail",
    content: <ClientDocumentDetailScenario />,
  },
  "client-billing": {
    name: "client-billing",
    content: <ClientBillingScenario />,
  },
  "client-invoice": {
    name: "client-invoice",
    content: <ClientInvoiceScenario />,
  },
  "client-services": {
    name: "client-services",
    content: <ClientServicesScenario />,
  },
  "client-service-enquiry": {
    name: "client-service-enquiry",
    content: <ClientServiceEnquiryScenario />,
  },
  "client-notifications": {
    name: "client-notifications",
    content: <ClientNotificationsScenario />,
  },
  "client-help": {
    name: "client-help",
    content: <ClientHelpScenario />,
  },
  "client-preferences": {
    name: "client-preferences",
    content: <ClientPreferencesScenario />,
  },
  "client-team": {
    name: "client-team",
    content: <ClientTeamScenario />,
  },
  "client-organisation-onboarding": {
    name: "client-organisation-onboarding",
    content: <ClientOrganisationOnboardingScenario />,
  },
  "client-unavailable": {
    name: "client-unavailable",
    content: <ClientUnavailableScenario />,
  },
  "client-invitation-expired": {
    name: "client-invitation-expired",
    content: <ClientInvitationExpiredScenario />,
  },
  "client-document-quarantine": {
    name: "client-document-quarantine",
    content: <ClientDocumentQuarantineScenario />,
  },
  "client-viewer-access": {
    name: "client-viewer-access",
    content: <ClientViewerAccessScenario />,
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
  "studio-request-detail": {
    name: "studio-request-detail",
    content: <StudioRequestDetailScenario />,
  },
  "studio-request-scope": {
    name: "studio-request-scope",
    content: <StudioRequestScopeScenario />,
  },
  "studio-request-create": {
    name: "studio-request-create",
    content: <StudioRequestCreateScenario />,
  },
  "studio-request-move": {
    name: "studio-request-move",
    content: <StudioRequestMoveScenario />,
  },
  "studio-agreement-list": {
    name: "studio-agreement-list",
    content: <StudioAgreementListScenario />,
  },
  "studio-agreement-builder": {
    name: "studio-agreement-builder",
    content: <StudioAgreementBuilderScenario />,
  },
  "studio-agreement-builder-scope": {
    name: "studio-agreement-builder-scope",
    content: <StudioAgreementBuilderScenario step="scope" />,
  },
  "studio-agreement-builder-fees": {
    name: "studio-agreement-builder-fees",
    content: <StudioAgreementBuilderScenario step="fees" />,
  },
  "studio-agreement-builder-people": {
    name: "studio-agreement-builder-people",
    content: <StudioAgreementBuilderScenario step="people" />,
  },
  "studio-agreement-builder-document": {
    name: "studio-agreement-builder-document",
    content: <StudioAgreementBuilderScenario step="document" />,
  },
  "studio-agreement-builder-review": {
    name: "studio-agreement-builder-review",
    content: <StudioAgreementBuilderScenario step="review" />,
  },
  "studio-agreement-no-engagement": {
    name: "studio-agreement-no-engagement",
    content: <StudioAgreementBuilderScenario noEngagement />,
  },
  "studio-agreement-signed": {
    name: "studio-agreement-signed",
    content: <StudioAgreementSignedScenario />,
  },
  "studio-engagement-provenance": {
    name: "studio-engagement-provenance",
    content: <StudioEngagementProvenanceScenario />,
  },
  "studio-signature-evidence": {
    name: "studio-signature-evidence",
    content: <StudioSignatureEvidenceScenario />,
  },
  "studio-signing-status": {
    name: "studio-signing-status",
    content: <StudioSigningStatusScenario />,
  },
  "studio-welcome-journeys": {
    name: "studio-welcome-journeys",
    content: <StudioWelcomeJourneysScenario />,
  },
  "studio-welcome-builder": {
    name: "studio-welcome-builder",
    content: <StudioWelcomeBuilderScenario stage="setup" />,
  },
  "studio-welcome-content": {
    name: "studio-welcome-content",
    content: <StudioWelcomeBuilderScenario stage="content" />,
  },
  "studio-welcome-access": {
    name: "studio-welcome-access",
    content: <StudioWelcomeBuilderScenario stage="access" />,
  },
  "studio-welcome-schedule": {
    name: "studio-welcome-schedule",
    content: <StudioWelcomeBuilderScenario stage="schedule" />,
  },
  "studio-welcome-without-billing": {
    name: "studio-welcome-without-billing",
    content: (
      <StudioWelcomeBuilderScenario
        stage="schedule"
        billingConfigured={false}
      />
    ),
  },
  "studio-welcome-preflight": {
    name: "studio-welcome-preflight",
    content: <StudioWelcomePreflightScenario />,
  },
  "studio-welcome-active": {
    name: "studio-welcome-active",
    content: <StudioWelcomeActiveScenario />,
  },
  "studio-welcome-recovery": {
    name: "studio-welcome-recovery",
    content: <StudioWelcomeRecoveryScenario />,
  },
  "studio-welcome-templates": {
    name: "studio-welcome-templates",
    content: <StudioWelcomeTemplatesScenario title="Welcome templates" />,
  },
  "studio-checklist-editor": {
    name: "studio-checklist-editor",
    content: (
      <StudioWelcomeTemplatesScenario title="Build the client checklist" />
    ),
  },
  "studio-checklist-task-editor": {
    name: "studio-checklist-task-editor",
    content: (
      <StudioWelcomeTemplatesScenario
        taskId={visualChecklistTaskId}
        title="Create a useful next step"
      />
    ),
  },
  "studio-clients": {
    name: "studio-clients",
    content: <StudioClientsScenario />,
  },
  "studio-client-detail": {
    name: "studio-client-detail",
    content: <StudioClientDetailScenario />,
  },
  "studio-client-create": {
    name: "studio-client-create",
    content: <StudioClientCreateScenario />,
  },
  "studio-billing-operations": {
    name: "studio-billing-operations",
    content: <StudioBillingOperationsScenario />,
  },
  "studio-portal-access": {
    name: "studio-portal-access",
    content: <StudioPortalAccessScenario />,
  },
  "studio-notification-delivery": {
    name: "studio-notification-delivery",
    content: <StudioNotificationDeliveryScenario />,
  },
  "studio-settings": {
    name: "studio-settings",
    content: <StudioSettingsScenario />,
  },
  "studio-project-edit": {
    name: "studio-project-edit",
    content: <StudioProjectEditScenario />,
  },
  "studio-journey-blocked": {
    name: "studio-journey-blocked",
    content: <StudioJourneyBlockedScenario />,
  },
  "studio-client-agreements": {
    name: "studio-client-agreements",
    content: <StudioClientAgreementRegisterScenario />,
  },
  "studio-client-requests": {
    name: "studio-client-requests",
    content: <StudioClientRequestRegisterScenario />,
  },
  "studio-client-signing": {
    name: "studio-client-signing",
    content: <StudioClientSigningRegisterScenario />,
  },
  "studio-projects": {
    name: "studio-projects",
    content: <StudioProjectRegisterScenario />,
  },
  "studio-project-create": {
    name: "studio-project-create",
    content: <StudioProjectCreateScenario />,
  },
  "studio-project-documents": {
    name: "studio-project-documents",
    content: <StudioProjectDocumentsScenario />,
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
