import type { Metadata } from "next";
import { createResourceMetadata } from "@/lib/seo/content-metadata";
import { notFound } from "next/navigation";

import { BreadcrumbSchema } from "@/components/seo/breadcrumb-schema";
import { ResourceDetailPage } from "@/components/resources/resource-detail-page";
import { PlumberPromptKitPage } from "@/components/resources/plumber-prompt-kit-page";
import {
  getAllResources,
  getRelatedResources,
  getResourceBySlug,
} from "@/lib/resources";

type ResourceRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const resources = await getAllResources();

  return resources.map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({
  params,
}: ResourceRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    return {
      title: "Resource not found",
      description: "The requested resource could not be found.",
    };
  }

  return createResourceMetadata(resource.meta);
}

export default async function ResourceRoutePage({
  params,
}: ResourceRouteProps) {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  const relatedResources = await getRelatedResources(resource.meta, 2);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", path: "/" },
          { name: "Resources", path: "/resources" },
          {
            name: resource.meta.title,
            path: `/resources/${resource.meta.slug}`,
          },
        ]}
      />
      {slug === "ai-prompts-for-plumbers" ? (
        <PlumberPromptKitPage resource={resource.meta} />
      ) : (
        <ResourceDetailPage
          resource={resource}
          relatedResources={relatedResources}
        />
      )}
    </>
  );
}
