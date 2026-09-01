import { notFound } from "next/navigation";

import { SeoAuditReview } from "@/components/growth/outreach/seo-audit-review";
import { getSeoAuditReview } from "@/lib/growth/dashboard/seo-audits";

export default async function SeoAuditReviewPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const result = await getSeoAuditReview(auditId);
  if (result.status === "not_found") notFound();
  return <SeoAuditReview result={result} />;
}
