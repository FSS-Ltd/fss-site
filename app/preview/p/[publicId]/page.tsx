import type { Metadata } from "next";

import { redirectProductionProspectPreviewPage } from "@/components/prospect-previews/production-prospect-preview-page";

type ProductionPreviewPageProps = {
  params: Promise<{ publicId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Private website concept",
    robots: { index: false, follow: false },
  };
}

export default async function ProductionProspectPreviewPage({
  params,
}: ProductionPreviewPageProps) {
  const { publicId } = await params;
  return redirectProductionProspectPreviewPage(publicId);
}
