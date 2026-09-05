import type { CommercialPageContent } from "./types";
import {
  comparisonLink,
  costLink,
  nexstepsLink,
  resourceLink,
  sectorLink,
  serviceLinks,
} from "./links";

export const authorityPages = {
  "/sectors/charities-faith-organisations": {
    path: "/sectors/charities-faith-organisations",
    kind: "sector",
    index: true,
    modifiedDate: "2026-09-04",
    label: "Charities and faith organisations",
    title: "Software for UK Charities & Faith Organisations | FSS",
    description:
      "Custom software, portals and automation for UK charities, churches and faith organisations. Explore practical services, NexSteps and project planning guidance.",
    heading: "Software for the people and processes behind your mission.",
    answer:
      "FSS builds custom software, portals and workflow automation for UK charities and faith organisations. We help teams define systems around their services, staff, volunteers and communities, with clear responsibilities for access, data and ongoing operation.",
    sections: [
      {
        id: "fit",
        title: "When administration starts getting in the way.",
        text: "Registration, attendance, reporting and handovers can become difficult to coordinate across separate tools. Start with the point where people repeat work, lose track of a request or cannot find the right record.",
      },
      {
        id: "outcomes",
        title: "Agree the change your team needs to see.",
        text: "Choose acceptance criteria that describe the work, rather than a list of screens. These are goals to agree for a project, not promised results.",
        points: [
          "Clear ownership of requests and approvals",
          "Access suited to staff, volunteers and families",
          "Records that support the reporting your organisation needs",
        ],
      },
      {
        id: "evidence",
        title: "Built by FSS: NexSteps.",
        text: "NexSteps is a safeguarding, attendance and operations platform for schools, churches and community organisations. It includes role-scoped access, support portals, safeguarding handover logs, parent onboarding and billing workflows.",
      },
      {
        id: "scope",
        title: "Choose the right amount of software.",
        text: "An existing product may meet the need through configuration. A portal, integration or defined custom workflow may be enough when it does not. Scope the operational problem before choosing a wider build, and include training and support in the budget.",
      },
      {
        id: "risk",
        title: "Treat people’s information with care.",
        text: "Agree which records a system needs, who may access them and who is responsible for checking changes. Discuss safeguarding responsibilities and data handling requirements during discovery without sharing sensitive personal records in an initial enquiry.",
      },
    ],
    faqs: [
      {
        question: "Do you work with churches as well as charities?",
        answer:
          "Yes. FSS’s software services include UK charities and faith organisations, with NexSteps providing an example of work for church and community operations.",
      },
      {
        question: "Should we buy software or commission a bespoke system?",
        answer:
          "Begin by testing existing products against your essential workflows. Consider bespoke work where an important need remains unmet and your organisation can support ongoing ownership.",
      },
      {
        question: "Can we start with a smaller project?",
        answer:
          "Yes. A defined portal, integration or single workflow can be scoped as a first release, with further work considered after review.",
      },
    ],
    related: [
      ...serviceLinks,
      nexstepsLink,
      costLink,
      comparisonLink,
      resourceLink,
    ],
  },
  "/work/nexsteps": {
    path: "/work/nexsteps",
    kind: "case-study",
    index: true,
    modifiedDate: "2026-09-04",
    label: "NexSteps",
    title: "NexSteps: Safeguarding & Community Operations Software | FSS",
    description:
      "Explore NexSteps, the FSS-built safeguarding, attendance and operations platform for schools, churches and community organisations, with a first-party interface example.",
    heading: "NexSteps: software for the people who care for others.",
    answer:
      "NexSteps is an FSS-built safeguarding, attendance and operations platform for schools, churches and community organisations. It brings role-scoped access, support portals, attendance and safeguarding handover logs, parent onboarding and billing workflows into one operational product.",
    sections: [
      {
        id: "fit",
        title: "Designed around community operations.",
        text: "The product addresses work involving attendance, safeguarding handovers and parent participation. Those tasks involve different people and responsibilities, which need to be reflected in the software.",
      },
      {
        id: "outcomes",
        title: "What FSS built.",
        text: "The supported product capabilities provide the evidence for this case study.",
        points: [
          "Role-scoped access and support portals",
          "Attendance and safeguarding handover logs",
          "Parent onboarding and billing workflows",
        ],
      },
      {
        id: "scope",
        title: "An example to inform a new scope.",
        text: "NexSteps can help frame a conversation about operational software for your organisation. It does not establish the price, delivery time or exact scope of a separate project. Those depend on your workflows, records and users.",
      },
      {
        id: "risk",
        title: "Software supports accountable people.",
        text: "Safeguarding responsibilities remain with the organisation and its people. Product capabilities alone are not a guarantee of security, compliance or safeguarding outcomes. A new project needs its own access, data and operating requirements.",
      },
    ],
    faqs: [
      {
        question: "Who built NexSteps?",
        answer: "Faithful Software Solutions built NexSteps.",
      },
      {
        question: "Which settings is NexSteps for?",
        answer:
          "NexSteps is a safeguarding, attendance and operations platform for schools, churches and community organisations.",
      },
      {
        question: "Are measured results available on this page?",
        answer:
          "This page documents product capabilities and a first-party interface example. It does not claim numerical improvements or present customer testimonials.",
      },
    ],
    related: [
      sectorLink,
      ...serviceLinks.slice(0, 3),
      costLink,
      comparisonLink,
      resourceLink,
    ],
  },
} satisfies Record<string, CommercialPageContent>;
