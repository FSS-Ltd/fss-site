import { AnalyticsPage } from "@/components/growth/analytics/analytics-page";
import { getAnalyticsResult, parseAnalyticsQuery } from "@/lib/growth/dashboard/analytics";

type GrowthAnalyticsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GrowthAnalyticsPage({
  searchParams,
}: GrowthAnalyticsPageProps) {
  const now = new Date();
  const query = parseAnalyticsQuery(await searchParams, now);
  const state = await getAnalyticsResult(query);

  return <AnalyticsPage month={query.month} state={state} />;
}
