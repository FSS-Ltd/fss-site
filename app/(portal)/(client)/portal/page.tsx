import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import {
  ClientOverview,
  ClientWorkspaceChooser,
} from "@/components/portal/overview/client-overview";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StudioUnavailable } from "@/components/portal/auth/studio-unavailable";
import { Notice, PageHeader } from "@/components/portal/ui";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { needsPortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import {
  listPortalMemberships,
  type PortalMembershipSummary,
} from "@/lib/operations/auth/require-member";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import {
  getActiveStaffMembership,
  hasStaffAccessOrInvitation,
} from "@/lib/operations/auth/staff-invitations";
import type { VerifiedPortalIdentity } from "@/lib/operations/auth/types";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { fssStudioEnabled } from "@/lib/operations/auth/release-flags";
import { operationsEnabled } from "@/lib/operations/db/client";
import { getPortalSigning } from "@/lib/operations/agreements/signing-service";
import { z } from "zod";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { loadClientOverview } from "@/lib/operations/overview/client-overview";

function requestedOrganisationId(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? undefined : value;
}

function NoActiveAccess(): React.JSX.Element {
  return (
    <div>
      <PageHeader
        description="You are signed in, but there is no active organisation linked to this account."
        eyebrow="Your FSS workspace"
        title="No active access"
      />
      <Notice tone="info">
        Open your invitation to activate access, or contact your FSS team for
        help.
      </Notice>
    </div>
  );
}

export default async function PortalHomePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;

  let identity: VerifiedPortalIdentity | null;
  try {
    identity = await getPortalIdentity();
  } catch {
    return <PortalUnavailable />;
  }
  if (!identity) redirect(portalPath("/portal/login"));

  let db: ReturnType<typeof getPortalDb>;
  let memberships: PortalMembershipSummary[];
  let onboardingRequired: boolean;
  let staffActive: boolean;
  let staffPending: boolean;
  try {
    db = getPortalDb();
    staffActive = Boolean(
      await getActiveStaffMembership(db, identity, randomUUID()),
    );
    staffPending =
      !staffActive &&
      (await hasStaffAccessOrInvitation(db, identity, randomUUID()));
    memberships = await listPortalMemberships(db, identity, randomUUID());
    onboardingRequired =
      memberships.length === 0 &&
      (await needsPortalOnboarding(db, identity, randomUUID()));
  } catch {
    return <PortalUnavailable />;
  }

  if (staffActive) {
    if (!fssStudioEnabled()) return <StudioUnavailable />;
    redirect(portalPath("/admin"));
  }
  if (staffPending) redirect(portalPath("/portal/login"));
  if (onboardingRequired) redirect(portalPath("/portal/onboarding"));
  if (memberships.length === 0) return <NoActiveAccess />;

  const organisationId = requestedOrganisationId(
    (await searchParams).organisationId,
  );
  const selectedMembership =
    memberships.length === 1
      ? memberships[0]
      : memberships.find(
          (membership) => membership.organisationId === organisationId,
        );

  if (!selectedMembership) {
    return <ClientWorkspaceChooser memberships={memberships} />;
  }

  let overview: Awaited<ReturnType<typeof loadClientOverview>>;
  let signatureNotice: string | undefined;
  try {
    overview = await loadClientOverview(
      db,
      identity,
      selectedMembership.organisationId,
      randomUUID(),
    );
    const signedApproval = z
      .uuid()
      .safeParse((await searchParams).signedApproval);
    if (signedApproval.success) {
      const approval = await getPortalSigning(
        db,
        identity,
        selectedMembership.organisationId,
        signedApproval.data,
        randomUUID(),
      );
      if (
        approval?.signatures.some(
          (signature) =>
            signature.email.toLowerCase() === identity.email.toLowerCase(),
        )
      ) {
        signatureNotice =
          approval.status === "completed"
            ? "Your signature is recorded and the signed agreement is ready."
            : "Your signature is recorded. We are preparing the signed copy.";
      }
    }
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <ClientOverview
      canCreateRequest={hasPortalCapability(
        selectedMembership.role,
        "requests.create",
      )}
      overview={overview}
      signatureNotice={signatureNotice}
      workspaceName={selectedMembership.displayName}
    />
  );
}
