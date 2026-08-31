import { OverviewPage } from "@/components/growth/overview/overview-page";
import { getIntegrationHealthSummary } from "@/lib/growth/dashboard/integration-health";
import {
  getOverviewViewModel,
  parseWorkQueueQuery,
} from "@/lib/growth/dashboard/overview";

type GrowthOverviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GrowthOverviewPage({
  searchParams,
}: GrowthOverviewPageProps) {
  const now = new Date().toISOString();
  const workQueueQuery = parseWorkQueueQuery(await searchParams);
  const [state, integrations] = await Promise.all([
    getOverviewViewModel(undefined, undefined, undefined, workQueueQuery),
    getIntegrationHealthSummary(),
  ]);

  return <OverviewPage integrations={integrations} now={now} state={state} />;
}
