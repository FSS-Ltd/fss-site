import { notFound } from "next/navigation";
import { operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { PortalLoginForm } from "@/components/portal/auth/login-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { portalPath } from "@/lib/operations/auth/portal-url";

export default function PortalLoginPage(): React.JSX.Element {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  return (
    <PortalLoginForm
      claimDestinations={{
        admin: portalPath("/admin"),
        home: portalPath("/portal"),
        onboarding: portalPath("/portal/onboarding"),
      }}
    />
  );
}
