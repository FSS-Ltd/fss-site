import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { OrganisationOnboarding } from "@/components/portal/auth/organisation-onboarding";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { needsPortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { listPortalMemberships } from "@/lib/operations/auth/require-member";
import {
  getActiveStaffMembership,
  hasStaffAccessOrInvitation,
} from "@/lib/operations/auth/staff-invitations";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";

export default async function PortalOnboardingPage(): Promise<React.JSX.Element> {
  if (!portalAuthConfigured()) return <PortalUnavailable />;

  let destination: string | null = null;
  try {
    const identity = await getPortalIdentity();
    if (!identity) {
      destination = portalPath("/portal/login");
    } else {
      const db = getPortalDb();
      const staff = await getActiveStaffMembership(db, identity, randomUUID());
      if (staff) {
        destination = portalPath("/admin");
      } else if (await hasStaffAccessOrInvitation(db, identity, randomUUID())) {
        destination = portalPath("/portal/login");
      } else {
        const hasMembership =
          (await listPortalMemberships(db, identity, randomUUID())).length > 0;
        const hasPendingInvitation = hasMembership
          ? false
          : await needsPortalOnboarding(db, identity, randomUUID());
        if (hasMembership || !hasPendingInvitation)
          destination = portalPath("/portal");
      }
    }
  } catch {
    return <PortalUnavailable />;
  }

  if (destination) redirect(destination);
  return <OrganisationOnboarding homePath={portalPath("/portal")} />;
}
