import { notFound } from "next/navigation";

import { ProspectDetailView } from "@/components/growth/prospects/prospect-detail";
import styles from "@/components/growth/prospects/prospects.module.css";
import { getIntegrationHealthSummary } from "@/lib/growth/dashboard/integration-health";
import { getProspectDetail } from "@/lib/growth/dashboard/prospect-detail";

type ProspectDetailPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function ProspectDetailPage({
  params,
}: ProspectDetailPageProps) {
  const { prospectId } = await params;
  const now = new Date().toISOString();
  const [result, integrations] = await Promise.all([
    getProspectDetail(prospectId),
    getIntegrationHealthSummary(),
  ]);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>Reference: {result.correlationId}</p>
      </div>
    );
  }

  return (
    <ProspectDetailView
      integrations={integrations}
      now={now}
      prospect={result.data}
    />
  );
}
