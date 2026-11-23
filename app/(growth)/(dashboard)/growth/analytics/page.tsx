import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getCampaignReports } from "@/lib/growth/dashboard/campaign-reports";
import { AnalyticsPage } from "@/components/growth/analytics/analytics-page";
import {
  getAnalyticsResult,
  parseAnalyticsQuery,
} from "@/lib/growth/dashboard/analytics";

type GrowthAnalyticsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GrowthAnalyticsPage({
  searchParams,
}: GrowthAnalyticsPageProps) {
  const founder = await requireFounder();
  const now = new Date();
  const query = parseAnalyticsQuery(await searchParams, now);
  const [state, campaignReports] = await Promise.all([
    getAnalyticsResult(query),
    getCampaignReports(founder),
  ]);

  return (
    <AnalyticsPage
      month={query.month}
      state={state}
      campaignReports={campaignReports}
    />
  );
}
