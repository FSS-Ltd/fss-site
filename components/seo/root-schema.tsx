import { siteConfig } from "@/lib/site-config";

import { JsonLd } from "@/components/seo/json-ld";

export function RootSchema() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: siteConfig.name,
    url: siteConfig.url,
    email: siteConfig.supportEmail,
    logo: siteConfig.url + "/FSS.png",
    description: siteConfig.description,
    areaServed: {
      "@type": "Country",
      name: "United Kingdom",
    },
    sameAs: [siteConfig.social.linkedin],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: siteConfig.url + "/blog?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
    </>
  );
}
