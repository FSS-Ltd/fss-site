import { notFound, redirect } from "next/navigation";

import { getFounderConceptPreviewHref } from "@/components/growth/prospects/concept-preview-href";
import styles from "@/components/growth/prospects/prospects.module.css";
import { getBespokeProspectPage } from "@/components/prospect-previews/bespoke/registry";
import { CompositionPreview } from "@/components/prospect-previews/composition-preview";
import { FounderDraftProspectPreview } from "@/components/prospect-previews/production-prospect-preview";
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
  const bespokePage = composition
    ? getBespokeProspectPage(composition.slug)
    : undefined;
  const previewHref = getFounderConceptPreviewHref({
    prospectId: result.data.prospectId,
    sourceSlug: bespokePage ? composition?.slug ?? null : null,
  });
  if (previewHref.startsWith("/preview/")) {
    redirect(previewHref);
  }

  if (composition) {
    return <CompositionPreview composition={composition} mode="review" />;
  }

  return <FounderDraftProspectPreview content={result.data.content} />;
}
