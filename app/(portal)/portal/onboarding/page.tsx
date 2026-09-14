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
  try {
    const identity = await getPortalIdentity();
    if (!identity) redirect("/portal/login");
    const db = getPortalDb();
    if ((await listPortalMemberships(db, identity, randomUUID())).length > 0)
      redirect("/portal");
    if (!(await needsPortalOnboarding(db, identity, randomUUID())))
      redirect("/portal");
    return <OrganisationOnboarding />;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return <PortalUnavailable />;
  }
}
