import { notFound, redirect } from "next/navigation";

import { FounderDraftProspectPreview } from "@/components/prospect-previews/production-prospect-preview";
import { CompositionPreview } from "@/components/prospect-previews/composition-preview";
import { getConceptPreviewHref } from "@/components/growth/prospects/concept-preview-href";
import styles from "@/components/growth/prospects/prospects.module.css";
import { getMergedProspectPreviewCompositionByProspectId } from "@/lib/growth/prospect-previews/compositions/manifest";
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

  if (result.data.slug !== null) {
    redirect(
      getConceptPreviewHref({
        prospectId: result.data.prospectId,
        slug: result.data.slug,
      }),
    );
  }

  const composition = getMergedProspectPreviewCompositionByProspectId(
    result.data.prospectId,
  );
  if (composition) {
    return <CompositionPreview composition={composition} mode="review" />;
  }

  return <FounderDraftProspectPreview content={result.data.content} />;
}
