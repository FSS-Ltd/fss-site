import { RequestBoard } from "@/components/portal/requests/board";
import { RequestDetail } from "@/components/portal/requests/request-detail";
import { RequestForm } from "@/components/portal/requests/request-form";
import { StaffDeliveryBoard } from "@/components/portal/requests/staff-delivery-board";
import { StaffRequestActions } from "@/components/portal/requests/staff-request-actions";
import styles from "@/components/portal/requests/requests.module.css";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PageHeader, PortalButton } from "@/components/portal/ui";
import type { PortalMembershipSummary } from "@/lib/operations/auth/require-member";
import type { StaffDeliveryBoardRequest } from "@/lib/operations/requests/staff-repository";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";

const organisationId = "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55";
const projectId = "584a707c-7072-4f5a-92d0-5b1447f05db5";

const memberships: readonly PortalMembershipSummary[] = [
  {
    displayName: "Northstar Studio",
    organisationId,
    role: "owner",
  },
];

const reviewRequest: ClientRequestDetail = {
  acknowledgementTarget: "2026-09-12T17:00:00Z",
  actualBehaviour: "",
  allowance: null,
  blocked: null,
  canReview: true,
  closureLabel: null,
  comments: [
    {
      authorLabel: "Jean-Fidele",
      body: "The booking confirmation is ready for your review.",
      createdAt: "2026-09-18T10:32:00Z",
      id: "cd3554da-6a7f-4df6-b252-92d62f382930",
    },
    {
      authorLabel: "Alex Morgan",
      body: "Please include our studio address in the confirmation.",
      createdAt: "2026-09-17T15:10:00Z",
      id: "71d73356-f4e3-4594-9e1b-7846a5b7cc4f",
    },
  ],
  createdAt: "2026-09-09T09:00:00Z",
  deliverableVersion: "v3",
  desiredDate: "2026-09-24",
  desiredOutcome:
    "Customers receive the correct time, studio address, and booking reference.",
  description:
    "Prepare the booking confirmation email for the new booking workflow.",
  documents: [
    {
      id: "fc9bc1f7-3148-4538-a9a5-6c018067d1c1",
      kind: "link",
      projectId,
      title: "Booking confirmation email preview · v3",
      url: "https://example.com/booking-confirmation-v3",
    },
  ],
  expectedBehaviour: "",
  id: "c014879c-6301-4ccb-b008-f1d3d5dc433c",
  impact: "Customers need the correct local booking time.",
  nextAction: "Review the preview and confirm the agreed outcome.",
  ownerDisplay: "Jean-Fidele",
  projectId,
  publicSummary:
    "Correct local time and clearer booking details, including the studio address and booking reference.",
  reproductionSteps: "",
  reviewCycle: 3,
  reviewInstructions:
    "Check the time, studio address, and booking reference in the preview.",
  reviewReminderTarget: "2026-09-23T17:00:00Z",
  reviews: [
    {
      createdAt: "2026-09-18T10:32:00Z",
      decision: "requested",
      deliverableVersion: "v3",
      documentIds: ["fc9bc1f7-3148-4538-a9a5-6c018067d1c1"],
      documents: [
        {
          id: "fc9bc1f7-3148-4538-a9a5-6c018067d1c1",
          kind: "link",
          projectId,
          title: "Booking confirmation email preview · v3",
          url: "https://example.com/booking-confirmation-v3",
        },
      ],
      feedback: "",
      id: "f35b15d4-d4f6-4c26-b877-41ea1f24fe76",
      reviewCycle: 3,
    },
  ],
  scope: "included",
  scopeReason: "Included in the signed website and booking workflow.",
  status: "ready_for_review",
  targetDate: "2026-09-24",
  title: "Booking confirmation email",
  type: "work",
  version: 7,
};

const boardRequests = [
  {
    ...reviewRequest,
    id: "1d879f2d-9a86-4d1c-a3cc-3f92af426341",
    status: "new" as const,
    title: "Customer account area",
    type: "change" as const,
  },
  {
    ...reviewRequest,
    id: "7e1d2ff5-f0d4-4aac-85c5-7b82a7ef3e43",
    status: "planned" as const,
    title: "Contact preferences",
    type: "work" as const,
  },
  {
    ...reviewRequest,
    id: "9c227a1a-2556-40d2-a3d8-93ce30fa2f50",
    status: "in_progress" as const,
    title: "Mobile spacing",
    type: "change" as const,
  },
  reviewRequest,
  {
    ...reviewRequest,
    id: "bf4b0a67-d96b-438b-a1a4-978b4f63704f",
    status: "changes_requested" as const,
    title: "Services page copy",
    type: "work" as const,
  },
  {
    ...reviewRequest,
    id: "0a03249a-a7de-4039-824a-2b31a7c06a17",
    status: "done" as const,
    title: "Brand landing page",
    type: "work" as const,
  },
];

const deliveryRequests: StaffDeliveryBoardRequest[] = boardRequests.map(
  (request, index) => ({
    blocked: index === 1,
    createdAt: request.createdAt,
    id: request.id,
    nextAction: request.nextAction,
    organisationId,
    organisationName: "Northstar Studio",
    ownerDisplay: request.ownerDisplay,
    priority: index === 0 ? "high" : "normal",
    scope: request.scope,
    status: request.status,
    targetDate: request.targetDate,
    title: request.title,
    version: request.version,
  }),
);

function ClientFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClientShell memberships={memberships}>{children}</ClientShell>;
}

export function ClientRequestBoardScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <div className={styles.requestPage}>
        <PageHeader
          action={<PortalButton type="button">New request</PortalButton>}
          description="Follow the status of every request and open any card for its next action."
          eyebrow="FSS Studio / Requests"
          title="Requests & feedback"
        />
        <RequestBoard
          filters={{ query: "" }}
          organisationId={organisationId}
          requests={boardRequests}
        />
      </div>
    </ClientFrame>
  );
}

function ClientRequestForm({
  initialType = "work",
}: Readonly<{
  initialType?: "bug" | "work";
}>): React.JSX.Element {
  const isBugReport = initialType === "bug";
  return (
    <ClientFrame>
      <div className={styles.requestPage}>
        <PageHeader
          breadcrumbs={[
            { label: "Requests", href: "/portal/requests" },
            { label: isBugReport ? "Report a problem" : "New request" },
          ]}
          description={
            isBugReport
              ? "Tell us what happened so FSS can reproduce it."
              : "A clear request helps FSS give you a useful next step."
          }
          eyebrow="FSS Studio / Requests"
          title={
            isBugReport
              ? "Report a problem"
              : "What would you like us to do?"
          }
        />
        <RequestForm
          initialType={initialType}
          organisationId={organisationId}
          projects={[{ id: projectId, title: "Website & booking experience" }]}
        />
      </div>
    </ClientFrame>
  );
}

export function ClientRequestFormScenario(): React.JSX.Element {
  return <ClientRequestForm />;
}

export function ClientBugReportScenario(): React.JSX.Element {
  return <ClientRequestForm initialType="bug" />;
}

export function ClientRequestReviewScenario(): React.JSX.Element {
  return (
    <ClientFrame>
      <div className={styles.requestPage}>
        <PageHeader
          breadcrumbs={[
            { label: "Requests", href: "/portal/requests" },
            { label: reviewRequest.title },
          ]}
          description="Review this exact deliverable version before accepting it or requesting changes."
          eyebrow="FSS Studio / Requests"
          title="Ready for your review"
        />
        <RequestDetail
          canComment
          hideTitle
          organisationId={organisationId}
          request={reviewRequest}
        />
      </div>
    </ClientFrame>
  );
}

export function StudioDeliveryBoardScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <div className={styles.requestPage}>
        <PageHeader
          description="Cross-client work ordered so open delivery and overdue follow-ups stay visible."
          eyebrow="FSS Studio / Delivery"
          title="Delivery board"
        />
        <StaffDeliveryBoard
          clients={[{ id: organisationId, displayName: "Northstar Studio" }]}
          filters={{ organisationId: "all", status: "all" }}
          requests={deliveryRequests}
        />
      </div>
    </StudioShell>
  );
}

export function StudioReviewPackageScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <div className={styles.requestPage}>
        <PageHeader
          breadcrumbs={[
            { label: "Delivery", href: "/admin/delivery" },
            { label: reviewRequest.title },
          ]}
          description="Complete the review package before publishing this move."
          eyebrow="FSS Studio / Delivery"
          title="Send work for review"
        />
        <StaffRequestActions
          deliveryOwners={[
            {
              id: "00000000-0000-4000-8000-000000000001",
              label: "Jean-Fidele",
            },
          ]}
          initialAction="review"
          organisationId={organisationId}
          request={{ ...reviewRequest, status: "in_progress" }}
        />
      </div>
    </StudioShell>
  );
}
