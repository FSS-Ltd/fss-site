import {
  resolveConceptPreviewSlug,
  type ConceptPreviewSlugInput,
} from "@/lib/growth/prospect-previews/preview-slugs";

export function getConceptPreviewHref({
  businessName,
  slug,
}: ConceptPreviewSlugInput): string | null {
  const previewSlug = resolveConceptPreviewSlug({ businessName, slug });
  if (!previewSlug) return null;

  return `/preview/${previewSlug}`;
}
