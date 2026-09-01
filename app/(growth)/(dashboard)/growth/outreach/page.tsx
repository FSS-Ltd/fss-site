import { OutreachList } from "@/components/growth/outreach/outreach-list";
import { SeoAuditList } from "@/components/growth/outreach/seo-audit-list";
import { getOutreachList } from "@/lib/growth/dashboard/outreach";
import { getSeoAuditList } from "@/lib/growth/dashboard/seo-audits";

export default async function OutreachPage() {
  const [result, seoAuditResult] = await Promise.all([
    getOutreachList(),
    getSeoAuditList(),
  ]);
  return (
    <>
      <OutreachList result={result} />
      <SeoAuditList result={seoAuditResult} />
    </>
  );
}
