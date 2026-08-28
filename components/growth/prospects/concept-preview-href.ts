type ConceptPreviewHrefInput = {
  prospectId: string;
  slug: string | null;
};

export function getConceptPreviewHref({
  prospectId,
  slug,
}: ConceptPreviewHrefInput): string {
  return slug ? `/preview/${slug}` : `/growth/prospects/${prospectId}/preview`;
}
