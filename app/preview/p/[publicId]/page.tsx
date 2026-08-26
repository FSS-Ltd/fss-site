import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductionProspectPreview } from "@/components/prospect-previews/production-prospect-preview";
import {
  getPublishedProspectPreview,
  type PublishedProspectPreview,
} from "@/lib/growth/prospect-previews/public-repository";

type ProductionPreviewPageProps = {
  params: Promise<{ publicId: string }>;
};

type PreviewLoader = (
  publicId: string,
) => Promise<PublishedProspectPreview | null>;

export const dynamic = "force-dynamic";

export async function generateMetadata(
  _props: ProductionPreviewPageProps,
): Promise<Metadata> {
  return {
    title: "Private website concept",
    robots: { index: false, follow: false },
  };
}

export async function renderProductionProspectPreviewPage(
  publicId: string,
  loadPreview: PreviewLoader = getPublishedProspectPreview,
) {
  const preview = await loadPreview(publicId);
  if (!preview) notFound();

  return <ProductionProspectPreview preview={preview} />;
}

export default async function ProductionProspectPreviewPage({
  params,
}: ProductionPreviewPageProps) {
  const { publicId } = await params;
  return renderProductionProspectPreviewPage(publicId);
}
