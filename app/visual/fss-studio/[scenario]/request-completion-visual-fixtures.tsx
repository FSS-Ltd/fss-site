import {
  RequestBoard,
  RequestBoardSkeleton,
} from "@/components/portal/requests/board";
import { RequestDetail } from "@/components/portal/requests/request-detail";
import { RequestForm } from "@/components/portal/requests/request-form";
import { StaffDeliveryBoard } from "@/components/portal/requests/staff-delivery-board";
import { StaffRequestActions } from "@/components/portal/requests/staff-request-actions";
import { StaffRequestForm } from "@/components/portal/requests/staff-request-form";
import styles from "@/components/portal/requests/requests.module.css";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PageHeader } from "@/components/portal/ui";
import { buildRequestDeliveryEmail } from "@/lib/operations/requests/notifications";
import type { StaffRequestCreationClient } from "@/lib/operations/requests/staff-repository";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import {
  requestVisualDeliveryRequests,
  requestVisualOrganisationId,
  requestVisualProjectId,
  requestVisualReviewRequest,
} from "./request-visual-fixtures";

const memberships = [
  {
    displayName: "Northstar Studio",
    organisationId: requestVisualOrganisationId,
    role: "owner" as const,
  },
];

const creationClients: StaffRequestCreationClient[] = [
  {
    displayName: "Northstar Studio",
    id: requestVisualOrganisationId,
    projects: [
      { id: requestVisualProjectId, title: "Website & booking experience" },
    ],
  },
];

function ClientFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClientShell memberships={memberships}>{children}</ClientShell>;
}

function ClientRequestPage({
  children,
  description,
  title,
}: Readonly<{
  children: React.ReactNode;
  description: string;
  title: string;
}>): React.JSX.Element {
  return (
    <ClientFrame>
      <div className={styles.requestPage}>
        <PageHeader
          breadcrumbs={[{ label: "Requests", href: "/portal/requests" }]}
          description={description}
          eyebrow="FSS Studio / Requests"
          title={title}
        />
        {children}
      </div>
    </ClientFrame>
  );
}

function StudioRequestPage({
  children,
  description,
  title,
}: Readonly<{
  children: React.ReactNode;
  description: string;
  title: string;
}>): React.JSX.Element {
  return (
    <StudioShell>
      <div className={styles.requestPage}>
        <PageHeader
          breadcrumbs={[{ label: "Delivery", href: "/admin/delivery" }]}
          description={description}
          eyebrow="FSS Studio / Delivery"
          title={title}
        />
        {children}
      </div>
    </StudioShell>
  );
}

function acceptedRequest(): ClientRequestDetail {
  return {
    ...requestVisualReviewRequest,
    closureLabel: "Accepted by client",
    nextAction:
      "This request is complete. Its final work and review history remain available.",
    reviews: [
      {
        ...requestVisualReviewRequest.reviews[0],
        createdAt: "2026-09-19T09:00:00Z",
        decision: "accepted",
        id: "db0c78c1-4b7f-4bae-b8e2-d423497d4ba4",
      },
      ...requestVisualReviewRequest.reviews,
    ],
    status: "done",
  };
}

export function ClientRequestDetailScenario(): React.JSX.Element {
  return (
    <ClientRequestPage
      description="Follow the next step, share public feedback, and open the exact deliverable when it is ready."
      title={requestVisualReviewRequest.title}
    >
      <RequestDetail
        canComment
        hideTitle
        organisationId={requestVisualOrganisationId}
        request={requestVisualReviewRequest}
        showReviewActions={false}
      />
    </ClientRequestPage>
  );
}

export function ClientRequestFeedbackScenario(): React.JSX.Element {
  return (
    <ClientRequestPage
      description="Review this exact deliverable version and tell FSS precisely what needs changing."
      title="Ready for your review"
    >
      <RequestDetail
        canComment
        hideTitle
        initialReviewDecision="request_changes"
        organisationId={requestVisualOrganisationId}
        request={requestVisualReviewRequest}
      />
    </ClientRequestPage>
  );
}

export function ClientRequestCompleteScenario(): React.JSX.Element {
  return (
    <ClientRequestPage
      description="The accepted deliverable and its review history remain available here."
      title={requestVisualReviewRequest.title}
    >
      <RequestDetail
        canComment
        hideTitle
        organisationId={requestVisualOrganisationId}
        request={acceptedRequest()}
        showReviewActions={false}
      />
    </ClientRequestPage>
  );
}

export function ClientRequestEmptyScenario(): React.JSX.Element {
  return (
    <ClientRequestPage
      description="A shared view of what is coming, moving and ready for you."
      title="Requests & feedback"
    >
      <RequestBoard
        filters={{ query: "" }}
        organisationId={requestVisualOrganisationId}
        requests={[]}
      />
    </ClientRequestPage>
  );
}

export function ClientRequestNoProjectScenario(): React.JSX.Element {
  return (
    <ClientRequestPage
      description="A clear request helps FSS give you a useful next step."
      title="What would you like us to do?"
    >
      <RequestForm organisationId={requestVisualOrganisationId} projects={[]} />
    </ClientRequestPage>
  );
}

export function ClientRequestConflictScenario(): React.JSX.Element {
  return (
    <ClientRequestPage
      description="Follow the latest request record before making a decision."
      title={requestVisualReviewRequest.title}
    >
      <RequestDetail
        canComment
        hideTitle
        initialConflict
        organisationId={requestVisualOrganisationId}
        request={requestVisualReviewRequest}
        showReviewActions={false}
      />
    </ClientRequestPage>
  );
}

export function ClientRequestLoadingScenario(): React.JSX.Element {
  return (
    <ClientRequestPage
      description="A shared view of what is coming, moving and ready for you."
      title="Requests & feedback"
    >
      <RequestBoardSkeleton />
    </ClientRequestPage>
  );
}

export function StudioRequestDetailScenario(): React.JSX.Element {
  return (
    <StudioRequestPage
      description="Manage the client-visible delivery record and post a public update separately from internal work."
      title={requestVisualReviewRequest.title}
    >
      <div className={styles.deliveryWorkspace}>
        <RequestDetail
          canComment={false}
          hidePortalActions
          hideTitle
          organisationId={requestVisualOrganisationId}
          request={requestVisualReviewRequest}
        />
        <div className={styles.deliveryControls}>
          <StaffRequestActions
            deliveryOwners={[
              {
                id: "00000000-0000-4000-8000-000000000001",
                label: "FSS delivery",
              },
            ]}
            initialAction="public_update"
            organisationId={requestVisualOrganisationId}
            request={requestVisualReviewRequest}
          />
        </div>
      </div>
    </StudioRequestPage>
  );
}

export function StudioRequestScopeScenario(): React.JSX.Element {
  return (
    <StudioRequestPage
      description="Assess scope before making an agreement or delivery commitment."
      title={requestVisualReviewRequest.title}
    >
      <StaffRequestActions
        deliveryOwners={[
          {
            id: "00000000-0000-4000-8000-000000000001",
            label: "FSS delivery",
          },
        ]}
        initialAction="classify_scope"
        organisationId={requestVisualOrganisationId}
        request={requestVisualReviewRequest}
      />
    </StudioRequestPage>
  );
}

export function StudioRequestCreateScenario(): React.JSX.Element {
  return (
    <StudioRequestPage
      description="Choose the client and project before creating a request. Scope remains under assessment until FSS records a decision."
      title="Create work for a client"
    >
      <StaffRequestForm clients={creationClients} />
    </StudioRequestPage>
  );
}

export function StudioRequestMoveScenario(): React.JSX.Element {
  return (
    <StudioRequestPage
      description="Cross-client work ordered so open delivery and overdue follow-ups stay visible."
      title="Delivery board"
    >
      <StaffDeliveryBoard
        clients={[
          { id: requestVisualOrganisationId, displayName: "Northstar Studio" },
        ]}
        filters={{ organisationId: "all", status: "all" }}
        initialMoveRequestId={requestVisualDeliveryRequests[0].id}
        requests={requestVisualDeliveryRequests}
      />
    </StudioRequestPage>
  );
}

function RequestEmailPreview({
  kind,
}: Readonly<{
  kind: "accepted" | "review_requested";
}>): React.JSX.Element {
  const email = buildRequestDeliveryEmail(
    {
      attempts: 1,
      completionAt: kind === "accepted" ? "2026-09-19T09:00:00Z" : null,
      deliverableVersion: "v3",
      id: "e3ed29c9-6b4f-4740-91fc-0567f04e66e8",
      kind,
      organisationId: requestVisualOrganisationId,
      organisationName: "Northstar Studio",
      publicSummary:
        "Correct local time and clearer booking details, including the studio address and booking reference.",
      recipient: "alex@northstar.example",
      requestId: requestVisualReviewRequest.id,
      requestTitle: requestVisualReviewRequest.title,
      reviewInstructions:
        "Check the time, studio address, and booking reference in the preview.",
    },
    "https://studio.example.test",
  );
  return (
    <div
      style={{
        background: "#eef2ef",
        minHeight: "100vh",
        padding: "48px 24px",
      }}
    >
      <article
        aria-label="FSS request email preview"
        dangerouslySetInnerHTML={{ __html: email.html }}
      />
    </div>
  );
}

export function ClientReviewRequestedEmailScenario(): React.JSX.Element {
  return <RequestEmailPreview kind="review_requested" />;
}

export function ClientWorkCompletedEmailScenario(): React.JSX.Element {
  return <RequestEmailPreview kind="accepted" />;
}
