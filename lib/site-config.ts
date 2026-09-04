import {
  getDeploymentContext,
  isPreviewDeployment,
  resolveSiteUrl,
} from "@/lib/config/site-url";

import { organisation } from "@/lib/seo/organisation";

const siteUrl = resolveSiteUrl();
const previewDeployment = isPreviewDeployment();

export const siteConfig = {
  name: organisation.name,
  fullName: organisation.legalName,
  title: "Faithful Software Solutions | Custom Software Development UK",
  description:
    "Bespoke software development for UK charities, schools, churches and businesses. Custom ERP, portals, dashboards and workflow automation built around your operational needs.",
  url: siteUrl,
  deploymentContext: getDeploymentContext(),
  isPreviewDeployment: previewDeployment,
  allowSearchIndexing: !previewDeployment,
  supportEmail: organisation.email,
  social: {
    linkedin: organisation.linkedin,
  },
};
