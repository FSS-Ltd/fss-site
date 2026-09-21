import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StaffJourneyOverview } from "@/components/portal/onboarding/staff-journey-overview";
import { Notice, PageHeader } from "@/components/portal/ui";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import {
  getOperationsDb,
  operationsEnabled,
  type OperationsDb,
} from "@/lib/operations/db/client";
import {
  listStaffJourneyOverview,
  type StaffJourneyOverviewRow,
} from "@/lib/operations/onboarding/queries";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";
import type { FssAdminContext } from "@/lib/operations/auth/staff-types";

export const dynamic = "force-dynamic";

export default async function AdminWelcomeJourneysPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let db: OperationsDb;
  let admin: FssAdminContext;
  try {
    db = getOperationsDb();
    admin = await requireFssAdmin(db, identity, randomUUID());
  } catch {
    return <PortalUnavailable />;
  }
  if (!onboardingEnabled()) {
    return (
      <main>
        <PageHeader
          description="This workspace stays unavailable until the approved onboarding worker and provider configuration are enabled."
          eyebrow="FSS Studio · Welcome journeys"
          title="Welcome journeys unavailable"
        />
        <Notice tone="info">
          No messages, access invitations, or billing effects can be prepared
          while onboarding is disabled.
        </Notice>
      </main>
    );
  }
  let journeys: StaffJourneyOverviewRow[];
  try {
    journeys = await listStaffJourneyOverview(db, admin);
  } catch {
    return <PortalUnavailable />;
  }
  return <StaffJourneyOverview journeys={journeys} />;
}
