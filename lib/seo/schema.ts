import { organisation } from "./organisation";

type SchemaNode = { "@type": string; "@id": string } & Record<string, unknown>;

export function buildRootSchema(): {
  "@context": string;
  "@graph": SchemaNode[];
} {
  const organisationId = `${organisation.url}/#organization`;
  const founderId = `${organisation.url}/about#founder`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organisationId,
        name: organisation.name,
        legalName: organisation.legalName,
        identifier: organisation.companyNumber,
        url: organisation.url,
        email: organisation.email,
        logo: `${organisation.url}/FSS.png`,
        areaServed: { "@type": "Country", name: organisation.areaServed },
        contactPoint: {
          "@type": "ContactPoint",
          email: organisation.email,
          contactType: "customer enquiries",
          availableLanguage: "English",
        },
        sameAs: [organisation.linkedin],
        founder: { "@id": founderId },
      },
      { "@type": "Person", "@id": founderId, name: organisation.founder.name },
      {
        "@type": "WebSite",
        "@id": `${organisation.url}/#website`,
        name: organisation.name,
        url: organisation.url,
        publisher: { "@id": organisationId },
        inLanguage: "en-GB",
      },
    ],
  };
}
