import { notFound } from "next/navigation";

import {
  getPublishedProspectPreview,
  type PublishedProspectPreview,
} from "@/lib/growth/prospect-previews/public-repository";

import { ProductionProspectPreview } from "./production-prospect-preview";

type PreviewLoader = (
  publicId: string,
) => Promise<PublishedProspectPreview | null>;

export async function renderProductionProspectPreviewPage(
  publicId: string,
  loadPreview: PreviewLoader = getPublishedProspectPreview,
) {
  const preview = await loadPreview(publicId);
  if (!preview) notFound();

  return <ProductionProspectPreview preview={preview} />;
}
