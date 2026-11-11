import type { PageMetadataInput } from "./metadata";
import { commercialPages } from "@/lib/commercial/pages";

export type PublicPage = PageMetadataInput & { modifiedDate: string };

// Baseline dates come from the last committed page-source edit. Update on substantive content changes.
export const publicPages = {
  ...commercialPages,
  "/": {
    path: "/",
    title: "AI Integration and Custom Software for Business | FSS",
    description:
      "FSS integrates AI, automates workflows and builds custom software for businesses of any size. See how it works in NexSteps and discuss your project with us.",
    modifiedDate: "2026-11-11",
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
    title: "AI and Software Insights for UK Businesses | FSS",
    description:
      "Practical articles on AI integration, workflow automation, private AI and custom software for UK businesses of any size, from owner-led firms to large teams.",
    modifiedDate: "2026-11-11",
    index: true,
  },
  "/contact": {
    path: "/contact",
    title: "Talk to FSS About AI or Custom Software",
    description:
      "Tell FSS what your team repeats by hand or what you want AI to do. Share your project and we will reply about scope, approvals, data handling and next steps.",
    modifiedDate: "2026-11-11",
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
    title: "Free AI and Software Planning Guides | FSS",
    description:
      "Download free guides on AI readiness, workflow automation, AI receptionists and custom software planning. Written for business owners and operations leads.",
    modifiedDate: "2026-11-11",
    index: true,
  },
  "/services": {
    path: "/services",
    title: "AI, Automation and Custom Software Services | FSS",
    description:
      "AI integration, AI agents, AI receptionists, readiness audits, workflow automation, private AI and custom software for UK businesses of any size, from FSS.",
    modifiedDate: "2026-11-11",
    index: true,
  },
  "/start": {
    path: "/start",
    title: "Business Idea Review: App, Website or Audience? | FSS",
    description:
      "Describe your business idea and goals. FSS reviews your answers and tells you whether the right first move is a website, an app, AI or building an audience.",
    modifiedDate: "2026-11-11",
    index: true,
  },
} satisfies Record<string, PublicPage>;
