import type { CommercialPageContent } from "./types";
import {
  comparisonLink,
  costLink,
  nexstepsLink,
  resourceLink,
  sectorLink,
  serviceLinks,
} from "./links";

export const guidePages = {
  "/guides/custom-software-cost-uk": {
    path: "/guides/custom-software-cost-uk",
    kind: "guide",
    index: true,
    modifiedDate: "2026-09-04",
    label: "Custom software cost in the UK",
    title: "Custom Software Cost UK: A Scope & Budget Guide | FSS",
    description:
      "Understand what shapes a custom software budget in the UK. A practical scope guide for charities and faith organisations, covering delivery and ongoing ownership.",
    heading: "Custom software cost starts with a defined scope.",
    answer:
      "There is no single useful price for custom software without knowing what it must do. For UK charities and faith organisations, a budget should account for workflows, user roles, integrations, migration and ongoing operation. This guide explains scope drivers; it is not a price list or quotation.",
    sections: [
      {
        id: "fit",
        title: "Give budget holders a decision they can assess.",
        text: "A list of features rarely explains the full work involved. Describe the operational problem, who will use the system and what must happen in the first release so trustees and budget holders can compare proposals on the same basis.",
      },
      {
        id: "outcomes",
        title: "Separate essential scope from later work.",
        text: "A useful brief defines what must be accepted before launch and what can wait.",
        points: [
          "Essential workflows and the people responsible for them",
          "User roles, access boundaries and reporting needs",
          "Existing systems, migration and integration requirements",
          "A first release with explicit acceptance criteria",
        ],
      },
      {
        id: "cost-drivers",
        title: "What changes the amount of work?",
        text: "A form feeding one reviewed queue differs from a portal with several roles, account recovery, historical records and external integrations. Unclear data, undocumented systems and complex exceptions increase the work needed to establish and deliver a reliable scope.",
      },
      {
        id: "ownership",
        title: "Budget beyond the initial build.",
        text: "Ask proposals to distinguish discovery, design, implementation, migration and launch from hosting, licences, maintenance, support and later changes. Confirm what is included, how changes are priced and who owns ongoing operation.",
      },
      {
        id: "evidence",
        title: "Use a real product to make the questions concrete.",
        text: "FSS-built NexSteps includes role-scoped access, parent onboarding and billing workflows. Each illustrates a scope question a buyer should ask. NexSteps is not used here as a price benchmark for your project.",
      },
      {
        id: "scope",
        title: "Compare like-for-like proposals.",
        text: "Ask each supplier to state assumptions, exclusions, acceptance criteria, responsibilities and recurring costs. Compare the same first release across proposals, including migration, training and handover.",
      },
      {
        id: "risk",
        title: "Watch for work hidden outside the estimate.",
        text: "Unassigned data cleanup, vague support terms and integrations that have not been examined can leave gaps in a budget. Resolve those responsibilities before making a delivery commitment.",
      },
    ],
    faqs: [
      {
        question: "Can you give a fixed price before discovery?",
        answer:
          "A defensible price needs an agreed scope and assumptions. An initial discussion can establish what must be examined before a proposal is prepared.",
      },
      {
        question: "How can a charity control the scope?",
        answer:
          "Define the essential first release, nominate a decision maker and assess proposed changes against the agreed acceptance criteria. Keep later ideas separate from launch requirements.",
      },
      {
        question: "Should we include a recurring budget?",
        answer:
          "Yes. Ask about hosting, licences, maintenance, support and future changes so the organisation understands the cost of operating the software after launch.",
      },
    ],
    related: [
      sectorLink,
      ...serviceLinks.slice(0, 3),
      nexstepsLink,
      comparisonLink,
      resourceLink,
    ],
  },
  "/blog/church-management-software-vs-bespoke": {
    path: "/blog/church-management-software-vs-bespoke",
    kind: "article",
    index: true,
    modifiedDate: "2026-09-04",
    label: "Church management software vs bespoke",
    title: "Church Management Software vs Bespoke: How to Decide | FSS",
    description:
      "A practical comparison for UK churches choosing between an existing church management product, an integration and bespoke software. Start with essential workflows.",
    heading: "Church management software or a bespoke system?",
    answer:
      "Start by testing existing church management software against your essential workflows. Bespoke software becomes worth considering when important needs remain unmet, integrations cannot close the gap and your church can take responsibility for ongoing ownership. The choice should follow the work your people need to do.",
    sections: [
      {
        id: "fit",
        title: "Write down the work before comparing products.",
        text: "Church administrators, ministry leads and trustees need a shared account of registration, attendance, communication and reporting needs. Include volunteers and people who use the system less often when checking whether a workflow is understandable.",
      },
      {
        id: "outcomes",
        title: "When an existing product is the better fit.",
        links: [sectorLink],
        text: "An existing product is worth testing first when its supported workflows meet the essential requirements and its access model, exports and support terms suit the organisation.",
        points: [
          "Test real tasks rather than relying on a feature checklist",
          "Check role permissions and how people leave the system",
          "Review data export, support and ongoing subscription terms",
        ],
      },
      {
        id: "bespoke",
        title: "When to investigate bespoke work.",
        links: [serviceLinks[0]],
        text: "Consider a custom system where a critical process cannot be supported by configuration and the gap justifies building and maintaining software. A smaller portal or integration may address the need without replacing every current tool.",
      },
      {
        id: "process",
        title: "Run a practical comparison.",
        text: "Select representative tasks, ask the people who do them to test the options and record where each succeeds or fails. Agree which gaps are essential, then compare a configured product, a targeted integration and a scoped bespoke release.",
      },
      {
        id: "evidence",
        title: "A first-party example: NexSteps.",
        links: [nexstepsLink],
        text: "FSS built NexSteps for safeguarding, attendance and operations in schools, churches and community organisations. Its capabilities show the kind of work a custom product can cover. They do not establish that bespoke software is the right choice for every church.",
      },
      {
        id: "scope",
        title: "Compare the whole ownership commitment.",
        links: [costLink],
        text: "For an existing product, examine subscriptions, configuration, migration and support. For bespoke work, include discovery, delivery, hosting, maintenance and future changes. No universal price comparison is possible without a defined scope.",
      },
      {
        id: "risk",
        title: "Plan for continuity and access.",
        text: "Check how records can be exported, who operates the system and what happens when a volunteer or supplier changes. Keep safeguarding responsibilities and sensitive data handling explicit whichever option you choose.",
      },
    ],
    faqs: [
      {
        question: "Is bespoke software always better for a church?",
        answer:
          "No. An existing product may meet the need with less implementation work. Bespoke development needs a clear reason and a plan for ongoing ownership.",
      },
      {
        question: "Can we keep our current church software?",
        answer:
          "Possibly. A portal or integration can address a specific gap where the current system’s interfaces and data access support it. Check those constraints before planning a build.",
      },
      {
        question: "Who should take part in the decision?",
        answer:
          "Include the people doing the work, the person responsible for data and access, and those accountable for the budget and ongoing operation.",
      },
    ],
    related: [
      sectorLink,
      serviceLinks[0],
      serviceLinks[1],
      nexstepsLink,
      costLink,
      resourceLink,
    ],
  },
} satisfies Record<string, CommercialPageContent>;
