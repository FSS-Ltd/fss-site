import {
  getDeploymentContext,
  isPreviewDeployment,
  resolveSiteUrl,
} from "@/lib/config/site-url";

const siteUrl = resolveSiteUrl();
const previewDeployment = isPreviewDeployment();

export const siteConfig = {
  name: "Faithful Software Solutions",
  fullName: "Faithful Software Solutions Ltd",
  title: "Faithful Software Solutions | Custom Software Development UK",
  description:
    "Bespoke software development for UK charities, schools, churches and businesses. Custom ERP, portals, dashboards and workflow automation built around your operational needs.",
  url: siteUrl,
  deploymentContext: getDeploymentContext(),
  isPreviewDeployment: previewDeployment,
  allowSearchIndexing: !previewDeployment,
  supportEmail: "hello@faithfulsoftware.dev",
  social: {
    linkedin: "https://www.linkedin.com/company/faithful-software-solutions",
  },
};
