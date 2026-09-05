import type { ResourceMeta } from "@/lib/types/resource";
import { canonicalUrl } from "@/lib/seo/metadata";
import { JsonLd } from "./json-ld";

export function ResourceSchema({ resource }: { resource: ResourceMeta }) {
  const file = resource.delivery;
  if (file.type !== "direct_download" || !file.url || !file.encodingFormat)
    return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "DigitalDocument",
        "@id": canonicalUrl(`/resources/${resource.slug}`) + "#document",
        name: resource.title,
        description: resource.summary,
        url: canonicalUrl(`/resources/${resource.slug}`),
        encoding: {
          "@type": "MediaObject",
          contentUrl: canonicalUrl(file.url),
          encodingFormat: file.encodingFormat,
        },
        author: {
          "@type": "Organization",
          name: resource.author,
          url: resource.authorUrl,
        },
        inLanguage: "en-GB",
      }}
    />
  );
}
