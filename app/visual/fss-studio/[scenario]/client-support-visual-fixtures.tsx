import { InvitationExpired } from "@/components/portal/auth/invitation-expired";
import { OrganisationTeamInvitation } from "@/components/portal/auth/organisation-team-invitation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientBillingOverview } from "@/components/portal/billing/client-billing-overview";
import { ClientInvoiceDetail } from "@/components/portal/billing/client-invoice-detail";
import type {
  InvoiceDetail,
  InvoiceSummary,
} from "@/components/portal/billing/presentation";
import { ClientDocumentDetail } from "@/components/portal/documents/client-document-detail";
import { ClientDocumentWorkspace } from "@/components/portal/documents/client-document-workspace";
import { ClientProjectDetail } from "@/components/portal/projects/client-project-detail";
import { ClientProjectList } from "@/components/portal/projects/client-project-list";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { ClientHelp } from "@/components/portal/support/client-help";
import { ClientServiceCatalogue } from "@/components/portal/services/client-service-catalogue";
import { ClientServiceEnquiry } from "@/components/portal/services/client-service-enquiry";
import { ClientNotificationInbox } from "@/components/portal/workspace/client-notification-inbox";
import { ClientProfilePreferences } from "@/components/portal/workspace/client-profile-preferences";
import { ClientTeamWorkspace } from "@/components/portal/workspace/client-team-workspace";
import { NotificationPreferences } from "@/components/portal/workspace/notification-preferences";
import type { PortalProfile } from "@/lib/operations/auth/user-profile";
import type { ClientDocumentDetail as ClientDocumentDetailData } from "@/lib/operations/documents/types";
import type { Offer } from "@/lib/operations/offers/types";
import type { ClientProjectDetail as ClientProjectDetailData } from "@/lib/operations/projects/types";
import type {
  PortalNotification,
  PortalTeamMember,
  PortalWorkspaceDocument,
} from "@/lib/operations/workspaces/types";

const organisationId = "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55";
const projectId = "584a707c-7072-4f5a-92d0-5b1447f05db5";

const memberships = [
  {
    displayName: "Northstar Studio",
    organisationId,
    role: "owner" as const,
  },
];

const project: ClientProjectDetailData = {
  agreementId: "34f0b2d6-ae1d-4f3a-b714-b3003e417488",
  deliverables: [
    "Five-page marketing website",
    "Booking workflow and confirmation email",
  ],
  id: projectId,
  milestones: [
    {
      evidence: "Reviewed visual direction recorded 18 September 2026.",
      id: "ff6b1d0f-2d90-4a11-b01d-6b1a16f1bd39",
      ownerDisplay: "Jean-Fidele",
      status: "completed",
      summary: "The visual direction and booking journey are agreed.",
      targetDate: "2026-09-18",
      title: "Design direction",
    },
    {
      evidence: null,
      id: "92267ec7-9185-4d1e-b3b5-eceae36f73f0",
      ownerDisplay: "Alex Morgan",
      status: "waiting_for_you",
      summary: "Review the booking confirmation and confirm the final wording.",
      targetDate: "2026-09-24",
      title: "Booking flow review",
    },
    {
      evidence: null,
      id: "0f5d1f1d-4cab-4d1c-a15d-d823a9f8de2b",
      ownerDisplay: "FSS Studio",
      status: "planned",
      summary: "Build, test and prepare the handover after approval.",
      targetDate: "2026-10-02",
      title: "Build and handover",
    },
  ],
  outcome: "A simpler route from enquiry to a confirmed booking.",
  ownerDisplay: "Jean-Fidele",
  scheduleDependencies: [
    "Confirm the studio address for the booking confirmation.",
  ],
  scheduleEvidence: null,
  status: "waiting_for_you",
  summary: "The new booking experience is ready for your team’s final review.",
  targetDate: "2026-10-02",
  title: "Website & booking experience",
};

const workspaceDocument: PortalWorkspaceDocument = {
  filename: "booking-flow-v3.pdf",
  id: "ef6d8da1-2921-4e25-a213-23b20af2bb6c",
  kind: "file",
  mimeType: "application/pdf",
  projectId,
  projectTitle: project.title,
  sizeBytes: 204_800,
  title: "Booking flow · v3",
};

const documentDetail: ClientDocumentDetailData = {
  ...workspaceDocument,
  createdAt: "2026-09-18T10:00:00.000Z",
  expiresAt: null,
  version: 3,
};

const openInvoice: InvoiceSummary = {
  amountDuePence: "120000",
  amountOverpaidPence: "0",
  amountPaidPence: "0",
  amountRemainingPence: "120000",
  currency: "GBP",
  dueDate: "2026-09-24",
  id: "22222222-2222-4222-8222-222222222222",
  mandateState: null,
  number: "INV-2026-041",
  paymentState: null,
  projectedAt: "2026-09-15T10:00:00.000Z",
  status: "open",
  totalPence: "120000",
};

const invoice: InvoiceDetail = {
  ...openInvoice,
  issuedAt: "2026-09-15T09:00:00.000Z",
  lines: [
    { amountPence: "90000", description: "Website build milestone" },
    { amountPence: "30000", description: "Booking workflow review" },
  ],
};

const offer: Offer = {
  audience: "Teams that need focused support after launch.",
  exclusions: ["New product features", "Out-of-scope copywriting"],
  id: "33333333-3333-4333-8333-333333333333",
  inclusions: ["Monthly maintenance", "Agreed support requests"],
  name: "Website care",
  outcome: "Keep your website useful, accurate and well supported.",
  pricePence: "45000",
  pricingDisplay: "fixed",
  recurrence: "monthly",
  setupNeeds: [],
  supportHours: "Weekday support hours apply.",
};

const notifications: readonly PortalNotification[] = [
  {
    body: "Your decision is needed before delivery can continue.",
    createdAt: "2026-09-21T10:30:00.000Z",
    id: "11111111-1111-4111-8111-111111111111",
    kind: "review_requested",
    readAt: null,
    requestId: "c014879c-6301-4ccb-b008-f1d3d5dc433c",
    requestVersion: 3,
    title: "Booking flow v3",
  },
  {
    body: "FSS recorded your approved design direction.",
    createdAt: "2026-09-19T14:15:00.000Z",
    id: "124cbd51-309f-4c9b-8199-1c56e93b69d9",
    kind: "status_changed",
    readAt: "2026-09-20T09:00:00.000Z",
    requestId: "c014879c-6301-4ccb-b008-f1d3d5dc433c",
    requestVersion: 2,
    title: "Delivery plan updated",
  },
];

const team: readonly PortalTeamMember[] = [
  {
    joinedAt: "2026-09-01T09:00:00.000Z",
    name: "Alex Morgan",
    role: "owner",
  },
  {
    joinedAt: "2026-09-03T11:30:00.000Z",
    name: "Maya Patel",
    role: "contributor",
  },
];

const ownerProfile: PortalProfile = {
  displayName: "Alex Morgan",
  email: "alex@northstar.example",
  organisationName: "Northstar Studio",
  requestEmailEnabled: true,
  role: "owner",
  timezone: "Europe/London",
};

function ClientFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClientShell memberships={memberships}>{children}</ClientShell>;
}

export function ClientProjectsScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientProjectList
        organisationId={organisationId}
        projects={[
          { ...project, scheduleDependencies: [], status: "active" },
          {
            ...project,
            id: "6b43e2f6-b1e4-4978-8354-fd95a7a62e8f",
            title: "Review booking confirmation",
          },
          {
            ...project,
            id: "1f18d361-3a72-4348-b07b-36f5c8e2205b",
            scheduleDependencies: [],
            status: "completed",
            summary: "The new brand landing page was handed over in August.",
            targetDate: "2026-08-28",
            title: "Brand landing page",
          },
        ]}
      />
    </ClientFrame>
  );
}

export function ClientProjectDetailScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientProjectDetail
        documents={[documentDetail]}
        organisationId={organisationId}
        project={project}
      />
    </ClientFrame>
  );
}

export function ClientDocumentsScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientDocumentWorkspace
        documents={[workspaceDocument]}
        organisationId={organisationId}
        uploadConfiguration={{
          enabled: false,
          reason:
            "Uploads are unavailable until an approved malware scanner is configured.",
        }}
      />
    </ClientFrame>
  );
}

export function ClientDocumentDetailScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientDocumentDetail
        document={documentDetail}
        organisationId={organisationId}
      />
    </ClientFrame>
  );
}

export function ClientBillingScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientBillingOverview
        canManage
        setupCurrency="GBP"
        setup={{
          method: null,
          status: "not_started",
          brand: null,
          last4: null,
          automaticConsent: false,
        }}
        invoices={[openInvoice]}
        organisationId={organisationId}
      />
    </ClientFrame>
  );
}

export function ClientInvoiceScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientInvoiceDetail
        canOpenHostedInvoice
        invoice={invoice}
        organisationId={organisationId}
      />
    </ClientFrame>
  );
}

export function ClientServicesScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientServiceCatalogue
        canEnquire
        offers={[offer]}
        organisationId={organisationId}
      />
    </ClientFrame>
  );
}

export function ClientServiceEnquiryScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientServiceEnquiry
        contactEmail={ownerProfile.email}
        offer={offer}
        organisationId={organisationId}
      />
    </ClientFrame>
  );
}

export function ClientNotificationsScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientNotificationInbox
        filter="all"
        notifications={notifications}
        organisationId={organisationId}
      />
    </ClientFrame>
  );
}

export function ClientHelpScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientHelp organisationId={organisationId} />
    </ClientFrame>
  );
}

export function ClientPreferencesScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientProfilePreferences
        notificationPreferences={
          <NotificationPreferences
            initialRequestEmailEnabled={ownerProfile.requestEmailEnabled}
            organisationId={organisationId}
          />
        }
        organisationId={organisationId}
        profile={ownerProfile}
      />
    </ClientFrame>
  );
}

export function ClientTeamScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientTeamWorkspace
        invitation={
          <OrganisationTeamInvitation organisationId={organisationId} />
        }
        members={team}
        organisationId={organisationId}
        role="owner"
      />
    </ClientFrame>
  );
}

export function ClientUnavailableScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <PortalUnavailable
        reference="FSS-PORTAL-20260921"
        retryHref="/portal?organisationId=f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55"
      />
    </ClientFrame>
  );
}

export function ClientInvitationExpiredScenario(): React.JSX.Element {
  return <InvitationExpired loginHref="/portal/login" />;
}

export function ClientDocumentQuarantineScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientDocumentWorkspace
        documents={[workspaceDocument]}
        organisationId={organisationId}
        quarantineNotice
        uploadConfiguration={{
          enabled: false,
          reason:
            "Uploads are unavailable until an approved malware scanner is configured.",
        }}
      />
    </ClientFrame>
  );
}

export function ClientViewerAccessScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <ClientProfilePreferences
        organisationId={organisationId}
        profile={{ ...ownerProfile, role: "viewer" }}
      />
    </ClientFrame>
  );
}
