import { notFound } from "next/navigation";

import { DealDetailView } from "@/components/growth/deals/deal-detail";
import styles from "@/components/growth/deals/deals.module.css";
import { getDealDetail } from "@/lib/growth/dashboard/deals";

type DealDetailPageProps = {
  params: Promise<{ engagementId: string }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { engagementId } = await params;
  const result = await getDealDetail(engagementId);

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

  return <DealDetailView deal={result.data} />;
}
