import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResourceThankYouPage } from "@/components/resources/resource-thank-you-page";
import { getAllResources, getResourceBySlug } from "@/lib/resources";

type ResourceThankYouRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const resources = await getAllResources();

  return resources.map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({ params }: ResourceThankYouRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    return {
      title: "Thank you",
      description: "Submission received.",
    };
  }

  return {
    title: `Thanks for requesting ${resource.meta.title}`,
    description: resource.meta.thankYouMessage,
    alternates: {
      canonical: "/resources/" + resource.meta.slug + "/thank-you",
    },
  };
}

export default async function ResourceThankYouRoutePage({ params }: ResourceThankYouRouteProps) {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  return <ResourceThankYouPage resource={resource.meta} />;
}
