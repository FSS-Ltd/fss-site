import { BillingOperations } from "@/components/portal/studio/billing-operations";
import { StudioClientDetail } from "@/components/portal/studio/client-detail";
import { StudioClientForm } from "@/components/portal/studio/client-form";
import { StudioClientRegister } from "@/components/portal/studio/client-register";
import { JourneyRecovery } from "@/components/portal/studio/journey-recovery";
import { NotificationDelivery } from "@/components/portal/studio/notification-delivery";
import { PortalAccessWorkspace } from "@/components/portal/studio/portal-access-workspace";
import { StudioProjectForm } from "@/components/portal/studio/project-form";
import { StudioSettings } from "@/components/portal/studio/studio-settings";
import { StudioShell } from "@/components/portal/shell/studio-shell";

const northstarId = "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55";
const projectId = "584a707c-7072-4f5a-92d0-5b1447f05db5";

function StudioFixture({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <StudioShell>{children}</StudioShell>;
}

export function StudioClientsScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <StudioClientRegister
        clients={{
          hasNext: false,
          items: [
            {
              activeWorkCount: 2,
              displayName: "Northstar Studio",
              id: northstarId,
              legalName: "Northstar Studio Ltd",
              lifecycle: "active",
              nextAction: "Review client work",
              nextActionHref: `/portal/admin/clients/${northstarId}/requests`,
              primaryContactName: "Alex Morgan",
            },
            {
              activeWorkCount: 1,
              displayName: "Harbour Foundation",
              id: "9d8be1e3-f8d8-4fe1-b15d-01e78c438384",
              legalName: "Harbour Foundation CIO",
              lifecycle: "active",
              nextAction: "Finish agreement",
              nextActionHref: "/portal/admin/agreements",
              primaryContactName: "Jamie Lee",
            },
          ],
          page: 1,
        }}
        query=""
      />
    </StudioFixture>
  );
}

export function StudioClientDetailScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <StudioClientDetail
        client={{
          activeJourneyCount: 1,
          billingCurrency: "GBP",
          currencyVersion: 1,
          activeProjectCount: 1,
          agreementCount: 1,
          billingExceptionCount: 1,
          displayName: "Northstar Studio",
          id: northstarId,
          legalName: "Northstar Studio Ltd",
          lifecycle: "active",
          nextAction: "Review client work",
          nextActionHref: `/portal/admin/clients/${northstarId}/requests`,
          openRequestCount: 2,
          primaryContactName: "Alex Morgan",
          timezone: "Europe/London",
        }}
      />
    </StudioFixture>
  );
}

export function StudioClientCreateScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <StudioClientForm />
    </StudioFixture>
  );
}

export function StudioBillingOperationsScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <BillingOperations
        data={{
          totalsByCurrency: [
            {
              currency: "GBP",
              dueThisMonthPence: "720000",
              overduePence: "240000",
            },
          ],
          hasNext: false,
          items: [
            {
              amountPence: "240000",
              currency: "GBP",
              category: "overdue_review",
              dueDate: "2026-09-12",
              id: "8f015e60-5af4-4d16-8ba2-7cc95bd962b4",
              lastObservedAt: "2026-09-20T10:00:00.000Z",
              organisationId: northstarId,
              organisationName: "Northstar Studio",
              providerReference: "in_test_northstar",
            },
          ],
          page: 1,
          reconciliationCount: 1,
        }}
      />
    </StudioFixture>
  );
}

export function StudioPortalAccessScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <PortalAccessWorkspace
        data={{
          view: "clients",
          canManageStaff: true,
          metrics: {
            activeClientUsers: 24,
            activeStaff: 3,
            pendingInvitations: 4,
            attentionInvitations: 1,
          },
          contacts: [
            {
              email: "a***@northstar.example",
              id: "1496e680-481d-4f84-9dc3-f68659520852",
              name: "Alex Morgan",
              organisationId: northstarId,
              organisationName: "Northstar Studio",
            },
          ],
          hasNext: false,
          items: [
            {
              accessType: "client",
              joinedAt: "2026-09-20T10:00:00.000Z",
              contactId: "1496e680-481d-4f84-9dc3-f68659520852",
              email: "alex@northstar.example",
              expiresAt: null,
              id: "membership:8e2dd56e-4a1d-4e8f-9188-ae4f42db95ec",
              invitedAt: "2026-09-15T10:00:00.000Z",
              lastVerifiedAt: "2026-09-20T10:00:00.000Z",
              membershipId: "8e2dd56e-4a1d-4e8f-9188-ae4f42db95ec",
              name: "Alex Morgan",
              organisationId: northstarId,
              organisationName: "Northstar Studio",
              role: "owner",
              state: "active",
            },
          ],
          page: 1,
          query: "",
          state: null,
        }}
      />
    </StudioFixture>
  );
}

export function StudioNotificationDeliveryScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <NotificationDelivery
        data={{
          hasNext: false,
          items: [
            {
              attempts: 2,
              id: "8f015e60-5af4-4d16-8ba2-7cc95bd962b4",
              kind: "review_requested",
              lastError: "provider_timeout",
              nextAttemptAt: "2026-09-22T10:00:00.000Z",
              organisationId: northstarId,
              organisationName: "Northstar Studio",
              recipientLabel: "a***@northstar.example",
              requestId: "c014879c-6301-4ccb-b008-f1d3d5dc433c",
              requestTitle: "Review booking flow · v3",
              status: "pending",
              updatedAt: "2026-09-21T10:00:00.000Z",
            },
          ],
          page: 1,
        }}
        selectedStatus="needs_attention"
      />
    </StudioFixture>
  );
}

export function StudioSettingsScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <StudioSettings
        settings={{
          active: {
            deliveryCapacity: "standard",
            displayName: "Faithful Software Solutions",
            replyTo: null,
            responseExpectationHours: 48,
            revision: 1,
            timezone: "Europe/London",
          },
          approvedReplyTo: [],
          draft: {
            createdAt: "2026-09-20T10:00:00.000Z",
            deliveryCapacity: "standard",
            displayName: "Faithful Software Solutions",
            replyTo: null,
            responseExpectationHours: 48,
            revision: 2,
            timezone: "Europe/London",
          },
          integrationConfiguration: [
            {
              available: true,
              detail: "Identity is managed by the portal deployment.",
              name: "Authentication",
            },
            {
              available: false,
              detail: "Request email delivery is deployment-managed.",
              name: "Email",
            },
            {
              available: true,
              detail: "Agreement signing uses retained approval evidence.",
              name: "Signing",
            },
            {
              available: false,
              detail: "Billing remains provider-owned.",
              name: "Billing",
            },
            {
              available: true,
              detail: "File safety status is supplied by the scanning worker.",
              name: "File scanning",
            },
          ],
        }}
      />
    </StudioFixture>
  );
}

export function StudioProjectEditScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <StudioProjectForm
        project={{
          agreementId: "b9141c6d-565c-4e03-8f25-b90c0647730a",
          deliverables: ["Booking flow", "Team handover"],
          id: projectId,
          internalEstimateMinutes: 960,
          internalNotes:
            "Confirm the client’s content review window before publishing.",
          milestones: [],
          organisationId: northstarId,
          outcome: "Make it easier for customers to book online.",
          ownerDisplay: "Jean-Fidele",
          scheduleDependencies: ["Client confirms booking copy"],
          scheduleEvidence: "Kickoff notes retained 18 September.",
          status: "active",
          summary: "A clear booking route from enquiry to confirmation.",
          targetDate: "2026-10-06",
          title: "Website & booking experience",
          version: 4,
          visibility: "client",
        }}
      />
    </StudioFixture>
  );
}

export function StudioJourneyBlockedScenario(): React.JSX.Element {
  return (
    <StudioFixture>
      <JourneyRecovery
        recovery={{
          canStart: false,
          checks: [
            { href: null, id: "contact", reason: "Ready.", status: "passed" },
            {
              href: "/portal/admin/agreements",
              id: "agreement",
              reason:
                "Refresh the current agreement before starting this journey.",
              status: "needs_action",
            },
            {
              href: "/portal/admin/settings",
              id: "sender",
              reason: "Choose an authorised FSS sender.",
              status: "needs_action",
            },
            { href: null, id: "template", reason: "Ready.", status: "passed" },
          ],
          draftId: "b9141c6d-565c-4e03-8f25-b90c0647730a",
          organisationId: northstarId,
          organisationName: "Northstar Studio",
          updatedAt: "2026-09-21T10:00:00.000Z",
        }}
      />
    </StudioFixture>
  );
}
