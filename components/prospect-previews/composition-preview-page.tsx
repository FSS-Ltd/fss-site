import type { ProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/types";

import { CompositionPreview } from "./composition-preview";

export type ProspectCompositionLoader = (
  slug: string,
) => Promise<ProspectPreviewComposition | null>;

export type RenderProspectCompositionPageInput = {
  slug: string;
  mode: "public" | "review";
  getReviewComposition: (
    slug: string,
  ) => ProspectPreviewComposition | null;
  getPublishedComposition: ProspectCompositionLoader;
};

export async function renderProspectCompositionPage({
  slug,
  mode,
  getReviewComposition,
  getPublishedComposition,
}: RenderProspectCompositionPageInput) {
  const composition =
    mode === "review"
      ? getReviewComposition(slug)
      : await getPublishedComposition(slug);
  if (composition === null) return null;

  return <CompositionPreview composition={composition} mode={mode} />;
}
