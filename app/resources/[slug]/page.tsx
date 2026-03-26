import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResourceDetailPage } from "@/components/resources/resource-detail-page";
import { getAllResources, getRelatedResources, getResourceBySlug } from "@/lib/resources";

type ResourceRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const resources = await getAllResources();

  return resources.map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({ params }: ResourceRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    return {
      title: "Resource not found",
      description: "The requested resource could not be found.",
    };
  }

  const canonicalPath = "/resources/" + resource.meta.slug;

  return {
    title: resource.meta.seoTitle,
    description: resource.meta.seoDescription,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: resource.meta.seoTitle,
      description: resource.meta.seoDescription,
      url: canonicalPath,
      images: [resource.meta.coverImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: resource.meta.seoTitle,
      description: resource.meta.seoDescription,
      images: [resource.meta.coverImage],
    },
  };
}

export default async function ResourceRoutePage({ params }: ResourceRouteProps) {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  const relatedResources = await getRelatedResources(resource.meta, 2);

  return <ResourceDetailPage resource={resource} relatedResources={relatedResources} />;
}
