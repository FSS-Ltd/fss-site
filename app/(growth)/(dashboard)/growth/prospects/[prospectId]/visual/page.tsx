import { notFound } from "next/navigation";

import { VisualConcept } from "@/components/growth/strategy/visual-concept";
import styles from "@/components/growth/strategy/strategy.module.css";
import { getVisualConcept } from "@/lib/growth/dashboard/website-strategy";

type VisualConceptPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function VisualConceptPage({
  params,
}: VisualConceptPageProps) {
  const { prospectId } = await params;
  const result = await getVisualConcept(prospectId);

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

  return <VisualConcept data={result.data} />;
}
