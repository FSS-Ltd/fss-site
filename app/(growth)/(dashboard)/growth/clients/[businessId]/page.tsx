import { notFound } from "next/navigation";

import { ClientDetailView } from "@/components/growth/clients/client-detail";
import styles from "@/components/growth/clients/clients.module.css";
import { getClientDetail } from "@/lib/growth/dashboard/clients";

type ClientDetailPageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { businessId } = await params;
  const result = await getClientDetail(businessId);

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

  return <ClientDetailView businessId={businessId} client={result.data} />;
}
