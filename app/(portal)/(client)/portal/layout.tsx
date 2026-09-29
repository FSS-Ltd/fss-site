import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import {
  listPortalMemberships,
  type PortalMembershipSummary,
} from "@/lib/operations/auth/require-member";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import {
  isPortalAppearance,
  PORTAL_APPEARANCE_COOKIE,
} from "@/lib/operations/design/portal-appearance";

async function ClientPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  const appearanceCookie = (await cookies()).get(
    PORTAL_APPEARANCE_COOKIE,
  )?.value;
  const initialAppearance = isPortalAppearance(appearanceCookie)
    ? appearanceCookie
    : "system";
  let memberships: PortalMembershipSummary[] = [];

  if (portalAuthConfigured()) {
    try {
      const identity = await getPortalIdentity();
      if (identity)
        memberships = await listPortalMemberships(
          getPortalDb(),
          identity,
          randomUUID(),
        );
    } catch {
      // Child pages keep their existing authenticated error states and guards.
    }
  }

  return (
    <ClientShell
      initialAppearance={initialAppearance}
      memberships={memberships}
    >
      {children}
    </ClientShell>
  );
}

export default ClientPortalLayout;
