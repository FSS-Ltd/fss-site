import { notFound, redirect } from "next/navigation";

import { getConceptPreviewHref } from "@/components/growth/prospects/concept-preview-href";
import { getPublishedProspectPreviewSlug } from "@/lib/growth/prospect-previews/public-repository";

type PreviewSlugLoader = (
  publicId: string,
) => Promise<string | null>;

export async function redirectProductionProspectPreviewPage(
  publicId: string,
  loadPreviewSlug: PreviewSlugLoader = getPublishedProspectPreviewSlug,
) {
  const previewHref = getConceptPreviewHref({
    slug: await loadPreviewSlug(publicId),
  });
  if (!previewHref) notFound();

  redirect(previewHref);
}
