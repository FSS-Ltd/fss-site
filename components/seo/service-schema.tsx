import { siteConfig } from "@/lib/site-config";

import { JsonLd } from "@/components/seo/json-ld";

const services = [
  {
    name: "Bespoke Software Development",
    description:
      "Custom software built around your operational needs. We design and build systems that fit exactly how your organisation works.",
    serviceType: "Custom Software Development",
  },
  {
    name: "Client Portal Development",
    description:
      "Secure self-service portals for clients, members, or staff. Reduce admin overhead and improve stakeholder experience.",
    serviceType: "Web Application Development",
  },
  {
    name: "Operational Dashboard Development",
    description:
      "Real-time dashboards giving leadership and teams visibility over the metrics that matter to their operations.",
    serviceType: "Business Intelligence Software",
  },
  {
    name: "Workflow Automation",
    description:
      "Automate repetitive manual processes — approvals, notifications, data entry, reporting — so your team can focus on higher-value work.",
    serviceType: "Process Automation",
  },
  {
    name: "Legacy System Migration",
    description:
      "Migrate from outdated spreadsheets, Access databases, or ageing software to modern, maintainable systems without losing your data or institutional knowledge.",
    serviceType: "Software Migration",
  },
];

export function ServiceSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Bespoke Software Development Services",
    description:
      "Custom software development services for UK charities, schools, churches and businesses.",
    itemListElement: services.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name: service.name,
        description: service.description,
        serviceType: service.serviceType,
        provider: {
          "@type": "ProfessionalService",
          name: siteConfig.name,
          url: siteConfig.url,
        },
        areaServed: {
          "@type": "Country",
          name: "United Kingdom",
        },
      },
    })),
  };

  return <JsonLd data={schema} />;
}
