import { notFound } from "next/navigation";
import { operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { Suspense } from "react";
import { PortalInvitationActivation } from "@/components/portal/auth/invitation-activation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalPath } from "@/lib/operations/auth/portal-url";

export default function PortalActivatePage(): React.JSX.Element {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  return (
    <Suspense fallback={<PortalUnavailable />}>
      <PortalInvitationActivation
        activationPath={portalPath("/portal/activate")}
        claimDestinations={{
          admin: portalPath("/admin"),
          home: portalPath("/portal"),
          onboarding: portalPath("/portal/onboarding"),
        }}
        loginPath={portalPath("/portal/login")}
      />
    </Suspense>
  );
}
