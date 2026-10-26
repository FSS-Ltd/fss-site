import { OutreachList } from "@/components/growth/outreach/outreach-list";
import { OutreachDrafts } from "@/components/growth/outreach/outreach-drafts";
import { SeoAuditList } from "@/components/growth/outreach/seo-audit-list";
import { getOutreachList } from "@/lib/growth/dashboard/outreach";
import { getOutreachDrafts } from "@/lib/growth/dashboard/outreach-drafts";
import { getSeoAuditList } from "@/lib/growth/dashboard/seo-audits";

import styles from "@/components/growth/outreach/outreach.module.css";

export default async function OutreachPage() {
  const [result, draftsResult, seoAuditResult] = await Promise.all([
    getOutreachList(),
    getOutreachDrafts(),
    getSeoAuditList(),
  ]);
  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.heading}>Outreach</h1>
        <p className={styles.subtitle}>
          Review email drafts and manage founder-approved Gmail sequences.
        </p>
      </header>
      <OutreachDrafts result={draftsResult} />
      <OutreachList result={result} />
      <SeoAuditList result={seoAuditResult} />
    </div>
  );
}
