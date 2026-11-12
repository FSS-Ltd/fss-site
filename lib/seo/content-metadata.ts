import type { Metadata } from "next";
import type { BlogPostMeta } from "@/lib/types/blog";
import type { ResourceMeta } from "@/lib/types/resource";
import { createPageMetadata } from "./metadata";

const SITE_SUFFIX = " | FSS";

export function createArticleMetadata(post: BlogPostMeta): Metadata {
  const metadata = createPageMetadata({
    path: `/blog/${post.slug}`,
    title: post.seoTitle.endsWith(SITE_SUFFIX)
      ? post.seoTitle
      : `${post.seoTitle}${SITE_SUFFIX}`,
    description: post.seoDescription,
    index: post.indexable,
  });
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: post.publishDate,
      modifiedTime:
        post.modifiedDate > post.publishDate
          ? post.modifiedDate
          : post.publishDate,
      authors: [post.author],
      section: post.category,
      tags: post.tags,
    },
  };
}

export function createResourceMetadata(resource: ResourceMeta): Metadata {
  return createPageMetadata({
    path: `/resources/${resource.slug}`,
    title: resource.seoTitle,
    description: resource.seoDescription,
    index: resource.indexable,
  });
}
