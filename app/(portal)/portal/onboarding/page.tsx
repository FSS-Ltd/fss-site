import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { OrganisationOnboarding } from "@/components/portal/auth/organisation-onboarding";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { needsPortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import { listPortalMemberships } from "@/lib/operations/auth/require-member";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";

export default async function PortalOnboardingPage(): Promise<React.JSX.Element> {
  if (!portalAuthConfigured()) return <PortalUnavailable />;

  let destination: "/portal/login" | "/portal" | null = null;
  try {
    const identity = await getPortalIdentity();
    if (!identity) {
      destination = "/portal/login";
    } else {
      const db = getPortalDb();
      const hasMembership =
        (await listPortalMemberships(db, identity, randomUUID())).length > 0;
      const hasPendingInvitation = hasMembership
        ? false
        : await needsPortalOnboarding(db, identity, randomUUID());
      if (hasMembership || !hasPendingInvitation) destination = "/portal";
    }
  } catch {
    return <PortalUnavailable />;
  }

  if (destination) redirect(destination);
  return <OrganisationOnboarding />;
}
