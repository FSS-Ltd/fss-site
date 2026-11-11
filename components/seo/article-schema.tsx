import type { BlogPostMeta } from "@/lib/types/blog";

import { JsonLd } from "@/components/seo/json-ld";
import { organisation } from "@/lib/seo/organisation";
import { organisationId, websiteId } from "@/lib/seo/schema";

type ArticleSchemaProps = {
  post: BlogPostMeta;
};

const organisationNode = {
  "@type": "Organization",
  "@id": organisationId,
  name: organisation.name,
  url: organisation.url,
};
const organisationLogo = {
  "@type": "ImageObject",
  url: `${organisation.url}/FSS.png`,
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
    author:
      !post.author || post.author === organisation.name
        ? organisationNode
        : {
            "@type": "Person",
            name: post.author,
            ...(post.authorUrl ? { url: post.authorUrl } : {}),
          },
    publisher: { ...organisationNode, logo: organisationLogo },
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
