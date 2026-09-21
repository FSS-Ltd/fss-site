import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientProfilePreferences } from "@/components/portal/workspace/client-profile-preferences";
import { NotificationPreferences } from "@/components/portal/workspace/notification-preferences";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { readPortalProfile } from "@/lib/operations/auth/user-profile";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  const profile = await readPortalProfile(
    getPortalDb(),
    context.identity,
    context.organisationId,
    randomUUID(),
  ).catch((error) => {
    if (error instanceof PortalAccessDenied) notFound();
    return null;
  });
  if (!profile) return <PortalUnavailable />;
  return (
    <ClientProfilePreferences
      organisationId={context.organisationId}
      profile={profile}
      notificationPreferences={
        profile.role === "owner" ? (
          <NotificationPreferences
            initialRequestEmailEnabled={profile.requestEmailEnabled}
            organisationId={context.organisationId}
          />
        ) : null
      }
    />
  );
}
