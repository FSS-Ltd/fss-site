import { notFound } from "next/navigation";
import { operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { Suspense } from "react";
import { PortalInvitationActivation } from "@/components/portal/auth/invitation-activation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";

export default function PortalActivatePage(): React.JSX.Element {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  return (
    <Suspense fallback={<PortalUnavailable />}>
      <PortalInvitationActivation />
    </Suspense>
  );
}
