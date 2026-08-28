type ConceptPreviewHrefInput = {
  prospectId: string;
};

export function getConceptPreviewHref({
  prospectId,
}: ConceptPreviewHrefInput): string {
  return `/growth/prospects/${prospectId}/preview`;
}

export function getFounderConceptPreviewHref(input: {
  prospectId: string;
  sourceSlug: string | null;
}): string {
  if (input.sourceSlug) return `/preview/${input.sourceSlug}`;

  return getConceptPreviewHref({ prospectId: input.prospectId });
}
