import { notFound, redirect } from "next/navigation";

import { getConceptPreviewHref } from "@/components/growth/prospects/concept-preview-href";
import styles from "@/components/growth/prospects/prospects.module.css";
import {
  getFounderDraftProspectPreviewDestination,
} from "@/lib/growth/prospect-previews/founder-review";

type FounderDraftPreviewPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function FounderDraftPreviewPage({
  params,
}: FounderDraftPreviewPageProps) {
  const { prospectId } = await params;
  const result = await getFounderDraftProspectPreviewDestination(prospectId);

  if (result.status === "not_found") notFound();

  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>Reference: {result.correlationId}</p>
      </div>
    );
  }

  const previewHref = getConceptPreviewHref({ slug: result.data.slug });
  if (!previewHref) notFound();

  redirect(previewHref);
}
