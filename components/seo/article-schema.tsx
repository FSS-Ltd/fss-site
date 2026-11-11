import type { BlogPostMeta } from "@/lib/types/blog";

import { JsonLd } from "@/components/seo/json-ld";
import { organisation } from "@/lib/seo/organisation";
import { organisationId, websiteId } from "@/lib/seo/schema";

type ArticleSchemaProps = {
  post: BlogPostMeta;
};

export function ArticleSchema({ post }: ArticleSchemaProps) {
  const articleUrl = `${organisation.url}/blog/${post.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${articleUrl}#article`,
    headline: post.seoTitle,
    description: post.seoDescription,
    datePublished: post.publishDate,
    dateModified:
      post.modifiedDate > post.publishDate
        ? post.modifiedDate
        : post.publishDate,
    author: { "@id": organisationId },
    publisher: { "@id": organisationId },
    isPartOf: { "@id": websiteId },
    inLanguage: "en-GB",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    image: [organisation.url + post.coverImage],
  };

  return <JsonLd data={articleSchema} />;
}
