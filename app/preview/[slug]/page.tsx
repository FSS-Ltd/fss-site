import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getBespokeProspectPage,
  getBespokeProspectSlugs,
} from "@/components/prospect-previews/bespoke/registry";
import { CompositionPreview } from "@/components/prospect-previews/composition-preview";
import { renderProspectCompositionPage } from "@/components/prospect-previews/composition-preview-page";
import { enforceFounderPrivatePreviewAccess } from "@/lib/growth/auth/private-preview-access";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { getMergedProspectPreviewCompositionBySlug } from "@/lib/growth/prospect-previews/compositions/manifest";
import { getPublishedProspectPreviewCompositionBySlug } from "@/lib/growth/prospect-previews/public-repository";

type PreviewPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getBespokeProspectSlugs().map((slug) => ({ slug }));
}

function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export async function generateMetadata({
  params,
}: PreviewPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bespokePage = getBespokeProspectPage(slug);
  const composition = getMergedProspectPreviewCompositionBySlug(slug);

  if (!bespokePage && !composition) {
    return {
      robots: { index: false, follow: false },
    };
  }

  return {
    title:
      bespokePage?.title ??
      composition?.copy.businessName,
    description:
      bespokePage?.description ??
      composition?.copy.headline,
    robots: { index: false, follow: false },
  };
}

export default async function ProspectPreviewPage({
  params,
}: PreviewPageProps) {
  const { slug } = await params;
  if (slug === "macknade") notFound();

  const bespokePage = getBespokeProspectPage(slug);
  if (bespokePage) {
    const BespokePage = bespokePage.Page;
    return <BespokePage />;
  }

  const production = isProduction();
  const sourcePage = await renderProspectCompositionPage({
    slug,
    mode: production ? "public" : "review",
    getReviewComposition: getMergedProspectPreviewCompositionBySlug,
    getPublishedComposition: (currentSlug) =>
      getPublishedProspectPreviewCompositionBySlug(
        currentSlug,
        getGrowthDb(),
        getMergedProspectPreviewCompositionBySlug,
      ),
  });
  if (sourcePage) return sourcePage;

  const composition = getMergedProspectPreviewCompositionBySlug(slug);
  if (production && composition) {
    await enforceFounderPrivatePreviewAccess(requireFounder, notFound);
    return <CompositionPreview composition={composition} mode="review" />;
  }

  notFound();
}
