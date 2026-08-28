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

export function getFounderConceptPreviewHref(input: {
  prospectId: string;
  storedSlug: string | null;
  sourceSlug: string | null;
}): string {
  return getConceptPreviewHref({
    prospectId: input.prospectId,
    slug: input.storedSlug ?? input.sourceSlug,
  });
}
