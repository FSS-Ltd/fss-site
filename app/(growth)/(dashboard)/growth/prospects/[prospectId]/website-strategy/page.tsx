import { notFound } from "next/navigation";

import { StrategyReview } from "@/components/growth/strategy/strategy-review";
import styles from "@/components/growth/strategy/strategy.module.css";
import { getWebsiteStrategy } from "@/lib/growth/dashboard/website-strategy";

type WebsiteStrategyPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function WebsiteStrategyPage({
  params,
}: WebsiteStrategyPageProps) {
  const { prospectId } = await params;
  const result = await getWebsiteStrategy(prospectId);

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

  return <StrategyReview data={result.data} />;
}
