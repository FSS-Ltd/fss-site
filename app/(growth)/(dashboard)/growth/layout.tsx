import { redirect } from "next/navigation";

import { GrowthShell } from "@/components/growth/shell/growth-shell";
import { enforceFounderDashboardAccess } from "@/lib/growth/auth/dashboard-access";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getIntegrationHealthSummary } from "@/lib/growth/dashboard/integration-health";

export const dynamic = "force-dynamic";

export default async function GrowthDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const founder = await enforceFounderDashboardAccess(requireFounder, redirect);
  const integrations = await getIntegrationHealthSummary();

  return (
    <GrowthShell founder={{ email: founder.email }} integrations={integrations}>
      {children}
    </GrowthShell>
  );
}
