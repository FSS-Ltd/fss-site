import { organisation } from "./organisation";
import { canonicalUrl, pageSchemaId } from "./metadata";

type SchemaNode = { "@type": string | string[]; "@id": string } & Record<
  string,
  unknown
>;

export const organisationId = `${organisation.url}/#organization`;
export const websiteId = `${organisation.url}/#website`;

// A byline that is empty, the company or one of its teams is not a person.
export function isOrganisationAuthor(author: string): boolean {
  const name = author.trim().toLowerCase();
  return (
    !name ||
    name === organisation.name.toLowerCase() ||
    name === organisation.legalName.toLowerCase() ||
    name.startsWith("fss") ||
    name.endsWith("team")
  );
}

export function buildPageSchema(
  type: "AboutPage" | "ContactPage",
  path: string,
  name: string,
  description: string,
): SchemaNode {
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
        description: organisation.summary,
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
