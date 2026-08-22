import Link from "next/link";

import { ClientThankYouReview } from "@/components/growth/clients/client-thank-you-review";
import styles from "@/components/growth/clients/clients.module.css";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getClientThankYouReview } from "@/lib/growth/dashboard/clients";

type ClientMessagePageProps = {
  params: Promise<{ businessId: string; messageId: string }>;
};

export default async function ClientMessagePage({ params }: ClientMessagePageProps) {
  const { businessId, messageId } = await params;
  const result = await getClientThankYouReview(
    messageId,
    readGrowthServerEnv().ownerEmail,
  );

  const breadcrumb = (
    <p className={styles.breadcrumb}>
      <Link href="/growth/clients">Clients</Link> /{" "}
      <Link href={`/growth/clients/${businessId}`}>Client</Link> / Thank-you
    </p>
  );

  if (result.status === "unavailable") {
    return (
      <div className={styles.detailPage}>
        {breadcrumb}
        <div className={styles.emptyState}>
          <p>{result.reason}</p>
        </div>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className={styles.detailPage}>
        {breadcrumb}
        <div className={styles.errorState} role="alert">
          <p>{result.message}</p>
          <p className={styles.errorCorrelation}>Reference: {result.correlationId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detailPage}>
      <p className={styles.breadcrumb}>
        <Link href="/growth/clients">Clients</Link> /{" "}
        <Link href={`/growth/clients/${businessId}`}>{result.data.businessName}</Link> /
        Thank-you
      </p>
      <ClientThankYouReview review={result.data} />
    </div>
  );
}
