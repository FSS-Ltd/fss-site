import type { PageMetadataInput } from "./metadata";
import { commercialPages } from "@/lib/commercial/pages";

export type PublicPage = PageMetadataInput & { modifiedDate: string };

// Baseline dates come from the last committed page-source edit. Update on substantive content changes.
export const publicPages = {
  ...commercialPages,
  "/": {
    path: "/",
    title: "Custom Software for UK Charities & Faith Organisations | FSS",
    description:
      "Custom software, portals and workflow automation for UK charities and faith organisations. Explore FSS-built NexSteps and discuss your operational software project.",
    modifiedDate: "2026-09-04",
    index: true,
  },
  "/about": {
    path: "/about",
    title: "About Faithful Software Solutions | UK Software Studio",
    description:
      "Faithful Software Solutions is a UK studio building dependable custom software, apps and private AI for organisations that need technology they can trust.",
    modifiedDate: "2026-09-04",
    index: true,
  },
  "/ai-deployment-questionnaire": {
    path: "/ai-deployment-questionnaire",
    title: "Local AI vs Cloud AI Questionnaire for Data-Sensitive Businesses",
    description:
      "Find out whether local AI, cloud AI, or hybrid AI is best for your business. Built for law firms, clinics, hospitals, finance teams, and privacy-sensitive organisations.",
    modifiedDate: "2026-08-17",
    index: true,
  },
  "/blog": {
    path: "/blog",
    title:
      "Software Development Insights for UK Businesses, Charities and Schools",
    description:
      "Practical articles on bespoke software strategy, portal development, workflow automation and digital modernisation for UK charities, schools and SMEs.",
    modifiedDate: "2026-09-05",
    index: true,
  },
  "/contact": {
    path: "/contact",
    title: "Discuss a custom software project | FSS",
    description:
      "Discuss a custom software project with Faithful Software Solutions. Share your organisation’s needs and we will reply about scope and next steps.",
    modifiedDate: "2026-09-04",
    index: true,
  },
  "/privacy": {
    path: "/privacy",
    title: "Privacy notice",
    description: "How Faithful Software Solutions Ltd handles personal data.",
    modifiedDate: "2026-08-26",
    index: true,
  },
  "/resources": {
    path: "/resources",
    title:
      "Free Software Strategy Guides for UK Charities, Schools and Businesses",
    description:
      "Download free practical guides on custom software planning, portal development and digital modernisation. Built for UK charity leaders, school administrators and business owners.",
    modifiedDate: "2026-09-05",
    index: true,
  },
  "/services": {
    path: "/services",
    title:
      "Bespoke Software Development UK | Portals, Dashboards & Workflow Automation",
    description:
      "Custom software development services for UK businesses, charities and schools. We build bespoke ERP systems, client portals, operational dashboards, workflow automation and legacy system migrations.",
    modifiedDate: "2026-09-04",
    index: true,
  },
  "/start": {
    path: "/start",
    title:
      "Business Idea Review | Should You Build an App, a Website, or an Audience First?",
    description:
      "Describe your business idea and goals. We'll review your answers and tell you whether the right first move is a website, an app, or building an audience before you build anything.",
    modifiedDate: "2026-08-17",
    index: true,
  },
} satisfies Record<string, PublicPage>;
