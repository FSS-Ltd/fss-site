type ConceptPreviewHrefInput = {
  slug: string | null;
};

const PREVIEW_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getConceptPreviewHref({
  slug,
}: ConceptPreviewHrefInput): string | null {
  if (!slug || !PREVIEW_SLUG_PATTERN.test(slug)) return null;

  return `/preview/${slug}`;
}
