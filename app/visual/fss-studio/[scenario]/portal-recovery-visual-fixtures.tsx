import { PortalFeatureUnavailable } from "@/components/portal/auth/feature-unavailable";
import { ClientShell } from "@/components/portal/shell/client-shell";

const organisationId = "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55";
export function ClientFeatureUnavailableScenario({
  feature,
}: Readonly<{ feature: "agreements" | "billing" }>): React.JSX.Element {
  return (
    <ClientShell
      memberships={[
        { displayName: "Northstar Studio", organisationId, role: "owner" },
      ]}
    >
      <PortalFeatureUnavailable
        feature={feature}
        organisationId={organisationId}
      />
    </ClientShell>
  );
}
