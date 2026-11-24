import { OutreachWorkspace } from "@/components/growth/outreach/outreach-workspace";
import { OutreachList } from "@/components/growth/outreach/outreach-list";
import { OutreachDrafts } from "@/components/growth/outreach/outreach-drafts";
import { SeoAuditList } from "@/components/growth/outreach/seo-audit-list";
import { getOutreachList } from "@/lib/growth/dashboard/outreach";
import { getOutreachDrafts } from "@/lib/growth/dashboard/outreach-drafts";
import { getSeoAuditList } from "@/lib/growth/dashboard/seo-audits";
import { getCampaignDailySummary } from "@/lib/growth/dashboard/campaign-daily-summary";
import { getCampaignAccounts } from "@/lib/growth/dashboard/campaign-accounts";
import { getCampaignOverview } from "@/lib/growth/dashboard/campaign-overview";
import { CampaignOverview } from "@/components/growth/outreach/campaign-overview";
import { requireFounder } from "@/lib/growth/auth/require-founder";

import styles from "@/components/growth/outreach/outreach.module.css";

export default async function OutreachPage() {
  const founder = await requireFounder();
  const [
    result,
    draftsResult,
    seoAuditResult,
    campaignResult,
    accountsResult,
    dailySummary,
  ] = await Promise.all([
    getOutreachList(),
    getOutreachDrafts(),
    getSeoAuditList(),
    getCampaignOverview(),
    getCampaignAccounts(founder),
    getCampaignDailySummary(founder),
  ]);
  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.heading}>Outreach</h1>
        <p className={styles.subtitle}>
          Review email drafts and manage founder-approved outreach campaigns.
        </p>
      </header>
      <OutreachWorkspace
        campaigns={
          <CampaignOverview
            result={campaignResult}
            accounts={accountsResult}
            dailySummary={dailySummary}
          />
        }
        drafts={<OutreachDrafts result={draftsResult} />}
        sequences={<OutreachList result={result} />}
        audits={<SeoAuditList result={seoAuditResult} />}
      />
    </div>
  );
}
