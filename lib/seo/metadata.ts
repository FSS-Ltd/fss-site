import type { Metadata } from "next";

import { siteConfig } from "@/lib/site-config";
import { organisation } from "./organisation";

export function canonicalUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Canonical paths must be local absolute paths.");
  }
  const url = new URL(path, organisation.url);
  return `${organisation.url}${url.pathname.replace(/\/+$/, "")}`;
}

export function pageSchemaId(path: string, fragment: string): string {
  return `${canonicalUrl(path)}#${fragment}`;
}

export function socialImage(path: string, alt: string) {
  const pathname = new URL(canonicalUrl(path)).pathname;
  return {
    url: `${organisation.url}/social${pathname === "/" ? "/home" : pathname}`,
    width: 1200,
    height: 630,
    alt,
  };
}

export type PageMetadataInput = {
  path: string;
  title: string;
  description: string;
  index?: boolean;
};

export function createPageMetadata({
  path,
  title,
  description,
  index = true,
}: PageMetadataInput): Metadata {
  const image = socialImage(path, title);
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalUrl(path),
      types: { "application/rss+xml": `${organisation.url}/feed.xml` },
    },
    robots: { index: index && siteConfig.allowSearchIndexing, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl(path),
      siteName: organisation.name,
      locale: "en_GB",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
