// TODO: Replace siteUrl with the production domain before going live.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://faithfulsoftwaresolutions.co.uk";

export const siteConfig = {
  name: "Faithful Software Solutions",
  fullName: "Faithful Software Solutions Ltd",
  title: "Faithful Software Solutions | Custom Software Development UK",
  description:
    "Bespoke software development for UK charities, schools, churches and businesses. Custom ERP, portals, dashboards and workflow automation built around your operational needs.",
  url: siteUrl,
  supportEmail: "hello@faithfulsoftwaresolutions.co.uk",
  social: {
    linkedin: "https://www.linkedin.com/company/faithful-software-solutions",
  },
};
