import { organisation } from "./organisation";
import { canonicalUrl, pageSchemaId } from "./metadata";

type SchemaNode = { "@type": string | string[]; "@id": string } & Record<
  string,
  unknown
>;

export const organisationId = `${organisation.url}/#organization`;
export const websiteId = `${organisation.url}/#website`;

export function buildPageSchema(
  type: "AboutPage" | "ContactPage",
  path: string,
  name: string,
  description: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": pageSchemaId(path, "webpage"),
    url: canonicalUrl(path),
    name,
    description,
    isPartOf: { "@id": websiteId },
    about: { "@id": organisationId },
    inLanguage: "en-GB",
  };
}

export function buildRootSchema(): {
  "@context": string;
  "@graph": SchemaNode[];
} {
  const founderId = `${organisation.url}/about#founder`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "ProfessionalService"],
        "@id": organisationId,
        name: organisation.name,
        legalName: organisation.legalName,
        description:
          "UK studio building AI integration, automation and custom software for businesses of any size.",
        identifier: organisation.companyNumber,
        url: organisation.url,
        email: organisation.email,
        logo: {
          "@type": "ImageObject",
          url: `${organisation.url}/FSS.png`,
        },
        address: { "@type": "PostalAddress", ...organisation.address },
        areaServed: { "@type": "Country", name: organisation.areaServed },
        knowsAbout: [
          "AI integration",
          "AI agents",
          "workflow automation",
          "private AI",
          "custom software development",
          "client portals",
          "software modernisation",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          email: organisation.email,
          contactType: "customer enquiries",
          availableLanguage: "English",
        },
        sameAs: [organisation.linkedin, organisation.companiesHouse],
        founder: { "@id": founderId },
      },
      { "@type": "Person", "@id": founderId, name: organisation.founder.name },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: organisation.name,
        url: organisation.url,
        publisher: { "@id": organisationId },
        inLanguage: "en-GB",
      },
    ],
  };
}
