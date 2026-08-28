import { notFound, redirect } from "next/navigation";

import { getFounderConceptPreviewHref } from "@/components/growth/prospects/concept-preview-href";
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

  const composition = getMergedProspectPreviewCompositionByProspectId(
    result.data.prospectId,
  );
  const previewHref = getFounderConceptPreviewHref({
    prospectId: result.data.prospectId,
    storedSlug: result.data.slug,
    sourceSlug: composition?.slug ?? null,
  });
  if (previewHref.startsWith("/preview/")) {
    redirect(previewHref);
  }

  return (
    <div className={styles.errorState} role="status">
      <p>This prospect does not yet have a bespoke concept source.</p>
    </div>
  );
}
