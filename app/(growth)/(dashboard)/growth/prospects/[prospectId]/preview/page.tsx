import { notFound } from "next/navigation";

import { FounderDraftProspectPreview } from "@/components/prospect-previews/production-prospect-preview";
import styles from "@/components/growth/prospects/prospects.module.css";
import { getFounderDraftProspectPreview } from "@/lib/growth/prospect-previews/founder-review";

type FounderDraftPreviewPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function FounderDraftPreviewPage({
  params,
}: FounderDraftPreviewPageProps) {
  const { prospectId } = await params;
  const result = await getFounderDraftProspectPreview(prospectId);

  if (result.status === "not_found") notFound();

  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>Reference: {result.correlationId}</p>
      </div>
    );
  }

  return <FounderDraftProspectPreview content={result.data.content} />;
}
