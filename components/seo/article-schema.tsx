import type { BlogPostMeta } from "@/lib/types/blog";

import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/site-config";

type ArticleSchemaProps = {
  post: BlogPostMeta;
};

export function ArticleSchema({ post }: ArticleSchemaProps) {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.seoTitle,
    description: post.seoDescription,
    datePublished: post.publishDate,
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: siteConfig.url + "/FSS.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": siteConfig.url + "/blog/" + post.slug,
    },
    image: [siteConfig.url + post.coverImage],
  };

  return <JsonLd data={articleSchema} />;
}
