import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { ClientOnboardingWorkspaceView } from "@/components/portal/onboarding/client-onboarding-workspace";
import { PortalFeatureUnavailable } from "@/components/portal/auth/feature-unavailable";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import {
  loadClientOnboardingWorkspace,
  type ClientOnboardingWorkspace,
} from "@/lib/operations/onboarding/client-workspace";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";

export const dynamic = "force-dynamic";

export default async function GettingStartedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  if (!onboardingEnabled())
    return (
      <PortalFeatureUnavailable
        feature="onboarding"
        organisationId={context.organisationId}
      />
    );
  let workspace: ClientOnboardingWorkspace;
  try {
    workspace = await loadClientOnboardingWorkspace(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <ClientOnboardingWorkspaceView
      organisationId={context.organisationId}
      workspace={workspace}
    />
  );
}
