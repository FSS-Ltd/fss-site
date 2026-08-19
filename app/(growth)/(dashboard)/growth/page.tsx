import { OverviewPage } from "@/components/growth/overview/overview-page";
import { getIntegrationHealthSummary } from "@/lib/growth/dashboard/integration-health";
import { getOverviewViewModel } from "@/lib/growth/dashboard/overview";

export default async function GrowthOverviewPage() {
  const now = new Date().toISOString();
  const [state, integrations] = await Promise.all([
    getOverviewViewModel(),
    getIntegrationHealthSummary(),
  ]);

  return <OverviewPage integrations={integrations} now={now} state={state} />;
}
