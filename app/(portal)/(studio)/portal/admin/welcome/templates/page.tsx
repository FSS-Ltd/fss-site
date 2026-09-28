import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { WelcomePackEditor } from "@/components/portal/onboarding/welcome-pack-editor";
import { PageHeader } from "@/components/portal/ui";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffWelcomePacks } from "@/lib/operations/onboarding/welcome-packs";

export const dynamic = "force-dynamic";

export default async function WelcomeTemplatesPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let packs;
  try {
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    packs = await listStaffWelcomePacks(getOperationsDb(), admin);
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <main>
      <PageHeader
        description="Maintain the shared welcome email, guide, next steps, and client checklist for each FSS service. New journeys use a published version and retain their own reviewed copy."
        eyebrow="FSS Studio · Welcome journeys"
        title="Shared welcome packs"
      />
      <WelcomePackEditor packs={packs} />
    </main>
  );
}
