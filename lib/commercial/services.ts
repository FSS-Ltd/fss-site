import type { CommercialPageContent } from "./types";
import { costLink, nexstepsLink, resourceLink, sectorLink } from "./links";

const serviceDefaults = {
  kind: "service",
  modifiedDate: "2026-09-04",
  index: true,
  related: [sectorLink, nexstepsLink, costLink, resourceLink],
} as const;

export const servicePages = {
  "/services/custom-software-development": {
    ...serviceDefaults,
    path: "/services/custom-software-development",
    label: "Custom software development",
    title: "Custom Software Development for UK Charities | FSS",
    description:
      "Bespoke operational software for UK charities and faith organisations. Plan workflows, permissions, integrations and a useful first release with FSS.",
    heading: "Custom software built around your organisation’s work.",
    answer:
      "FSS builds bespoke operational software for UK charities and faith organisations when existing tools cannot support the way their teams work. We define the workflows, people and data involved before agreeing a first release.",
    sections: [
      {
        id: "fit",
        title: "When the work no longer fits a spreadsheet.",
        text: "This service is for operations leads who need people, records and decisions to move through a shared system. Repeated data entry, unclear ownership and reports assembled by hand are useful starting points for discovery.",
      },
      {
        id: "outcomes",
        title: "Define what a useful system should do.",
        text: "Agree practical acceptance criteria with the people doing the work. The aim is a system your team can use and maintain, with responsibilities made explicit.",
        points: [
          "One agreed workflow for each operational task",
          "Access based on each person’s role",
          "Reports drawn from the records your team maintains",
        ],
      },
      {
        id: "evidence",
        title: "Operational software in practice.",
        text: "FSS built NexSteps, a safeguarding, attendance and operations platform for schools, churches and community organisations. Its role-scoped access and parent onboarding provide a concrete example of this kind of work.",
      },
      {
        id: "scope",
        title: "Start with a defined first release.",
        text: "User roles, integrations, migration and reporting affect scope. We work through these before proposing a price. A smaller first release can establish the essential workflow before further modules are considered.",
      },
      {
        id: "risk",
        title: "Plan for the work around the software.",
        text: "Data quality, training and ownership can determine whether a system is adopted. Agree who checks migrated records, who accepts the release and who operates it after launch.",
      },
    ],
    faqs: [
      {
        question: "When is bespoke software appropriate?",
        answer:
          "When an important workflow cannot be supported adequately by configuring existing tools, and your organisation can own the ongoing operation and maintenance of the system.",
      },
      {
        question: "Can a project begin with one workflow?",
        answer:
          "Yes. A first release can focus on one defined workflow, with further work scoped separately once the team has reviewed it.",
      },
      {
        question: "What should we bring to the first conversation?",
        answer:
          "Describe the operational problem, the people involved, your existing systems and any constraints on budget, timing or data handling. Use anonymised examples.",
      },
    ],
  },
  "/services/portal-development": {
    ...serviceDefaults,
    path: "/services/portal-development",
    label: "Portal development",
    title: "Portal Development for UK Charities & Faith Organisations | FSS",
    description:
      "Plan and build member, parent and team portals with FSS. Define onboarding, role-based access and operational workflows for your UK organisation.",
    heading: "A clear place for people to access the work that concerns them.",
    answer:
      "FSS develops portals for UK charities and faith organisations that need members, parents or staff to complete tasks and see relevant information. The starting point is who needs access, what they need to do and which records they should be able to see.",
    sections: [
      {
        id: "fit",
        title: "Give repeated requests a defined route.",
        text: "A portal can suit teams handling registration, document requests or updates across email and spreadsheets. Map those tasks before adding a new place for people to sign in.",
      },
      {
        id: "outcomes",
        title: "Make the next action understandable.",
        text: "The intended result is a usable route through each task, with clear status and an identified person responsible for follow-up.",
        points: [
          "Accessible onboarding and account recovery",
          "Information and actions scoped to each role",
          "Clear submitted, pending and completed states",
        ],
      },
      {
        id: "evidence",
        title: "Portal work in NexSteps.",
        text: "NexSteps includes role-scoped access, support portals and parent onboarding. FSS built these alongside its safeguarding, attendance and operational workflows.",
      },
      {
        id: "scope",
        title: "Permissions and integrations shape the scope.",
        text: "The number of roles, identity requirements, existing records and any billing or document workflows affect the build. Agree the account lifecycle and support needs before setting the delivery scope.",
      },
      {
        id: "risk",
        title: "Access needs deliberate design.",
        text: "Define how access is granted, reviewed and removed. Test permissions and account recovery, and decide what happens when someone leaves or needs help completing a task.",
      },
    ],
    faqs: [
      {
        question: "Can different people see different information?",
        answer:
          "Yes. Roles and permission boundaries should be agreed during discovery and tested against the actions and records each role needs.",
      },
      {
        question: "Can a portal connect to our current systems?",
        answer:
          "That depends on the systems’ supported interfaces and data access. Reviewing these is part of scoping, before promising an integration.",
      },
      {
        question: "Does every member need an account?",
        answer:
          "Not necessarily. Identify which tasks need authenticated access and which can be completed without an account before designing onboarding.",
      },
    ],
  },
  "/services/workflow-automation": {
    ...serviceDefaults,
    path: "/services/workflow-automation",
    label: "Workflow automation",
    title: "Workflow Automation for UK Charities | FSS",
    description:
      "Connect operational tools and reduce repeated data entry with FSS. Scope workflow automation with human review, exception handling and clear ownership.",
    heading: "Connect the steps your team keeps repeating.",
    answer:
      "FSS helps UK charities and faith organisations automate defined operational workflows between their existing tools. We map the trigger, data, decisions and exceptions so routine work can move forward with human review where judgement matters.",
    sections: [
      {
        id: "fit",
        title: "Start with a process people can explain.",
        text: "Look for repeated copying, routine notifications or records that need updating in more than one place. If the rules are still unclear, settle the process with the team before automating it.",
      },
      {
        id: "outcomes",
        title: "Agree how a successful run behaves.",
        text: "Automation should make the status of work easier to understand, including when it needs attention.",
        points: [
          "Defined triggers and expected outputs",
          "Human review for decisions that need judgement",
          "A visible route for failed or incomplete work",
        ],
      },
      {
        id: "evidence",
        title: "Connected workflows in NexSteps.",
        text: "FSS-built NexSteps includes parent onboarding and billing workflows alongside attendance and safeguarding handover logs. These are examples of operational tasks being designed as part of a wider system.",
      },
      {
        id: "scope",
        title: "Count the exceptions as well as the happy path.",
        text: "Connected systems, interface limits, data quality, approvals and recovery steps affect scope. Begin with one process and agree how it will be checked before extending it.",
      },
      {
        id: "risk",
        title: "Make failures recoverable.",
        text: "Plan for duplicate submissions, unavailable services and incomplete data. Decide who receives alerts, how a run can be retried and which actions need approval before they happen.",
      },
    ],
    faqs: [
      {
        question: "Do we need to replace our current software?",
        answer:
          "Not always. Existing tools may be connected where their interfaces and permissions support the required workflow. Discovery establishes what is possible.",
      },
      {
        question: "Can approvals stay with our team?",
        answer:
          "Yes. Human approval can remain a defined step, particularly where a decision affects people, money or sensitive records.",
      },
      {
        question: "How should we choose the first process?",
        answer:
          "Choose a repeated process with a clear owner, known inputs and measurable acceptance criteria. Include its exceptions when describing it.",
      },
    ],
  },
  "/services/software-modernisation": {
    ...serviceDefaults,
    path: "/services/software-modernisation",
    label: "Software modernisation",
    title: "Software Modernisation for UK Organisations | FSS",
    description:
      "Assess and modernise operational software with FSS. Plan data migration, integrations, testing and handover around your charity or faith organisation’s work.",
    heading: "Move an existing system forward with a clear migration plan.",
    answer:
      "FSS helps UK organisations assess and modernise operational software that has become difficult to maintain or adapt. We examine what needs to keep working, what can change and how records and users will move to the next version.",
    sections: [
      {
        id: "fit",
        title: "Understand what the current system still does well.",
        text: "For charity and faith operations teams, an older system may hold years of records and established routines. Document those dependencies before choosing an upgrade, targeted replacement or broader rebuild.",
      },
      {
        id: "outcomes",
        title: "Keep continuity part of the acceptance criteria.",
        text: "A modernisation project should have a clear account of the behaviours and records that must be preserved.",
        points: [
          "Documented workflows and integration dependencies",
          "A migration plan with record checks",
          "An agreed cutover, rollback and handover approach",
        ],
      },
      {
        id: "evidence",
        title: "Experience building operational systems.",
        text: "FSS built NexSteps for safeguarding, attendance and community operations. It illustrates our operational software work; it is not presented as a legacy migration case study.",
      },
      {
        id: "scope",
        title: "Assessment comes before a replacement estimate.",
        text: "Source access, data formats, integrations and undocumented behaviours affect effort. A scoped assessment can establish the work needed before the organisation commits to a migration.",
      },
      {
        id: "risk",
        title: "Test the transition, not just the new screens.",
        text: "Rehearse data migration with representative records, check access boundaries and agree when to pause or reverse a cutover. Plan training and support for the people changing routines.",
      },
    ],
    faqs: [
      {
        question: "Must modernisation mean a full rebuild?",
        answer:
          "No. An assessment may identify changes to an existing system or a phased replacement as a better fit. The choice depends on the system and its constraints.",
      },
      {
        question: "Can existing records be moved?",
        answer:
          "Migration depends on access, formats and data quality. Review a representative, appropriately redacted sample before defining a migration plan.",
      },
      {
        question: "Can you promise no disruption?",
        answer:
          "No blanket promise is appropriate. Define continuity requirements, test the transition and agree a recovery plan before cutover.",
      },
    ],
  },
  "/services/private-ai": {
    ...serviceDefaults,
    path: "/services/private-ai",
    label: "Private AI",
    title: "Private & Local AI Planning for UK Organisations | FSS",
    description:
      "Assess private, local or self-hosted AI with FSS. Define data boundaries, hardware needs, evaluation and human oversight before committing to deployment.",
    heading: "Assess private AI against the work and the data it will handle.",
    answer:
      "FSS helps UK organisations assess whether local, on-device or self-hosted AI fits a defined task. We consider data boundaries, hardware, access, model quality and ongoing operation before recommending a deployment approach.",
    sections: [
      {
        id: "fit",
        title: "Begin with a narrow task.",
        text: "Charities and faith organisations considering document search or drafting assistance need to define the source material and who may use it. Establish whether AI is useful for the task before choosing where it runs.",
      },
      {
        id: "outcomes",
        title: "Make the decision testable.",
        text: "The aim of an assessment is evidence for a deployment decision, with the limits of the proposed system understood.",
        points: [
          "A defined task and representative evaluation examples",
          "Documented data access and deployment boundaries",
          "Human review and an owner for ongoing operation",
        ],
      },
      {
        id: "evidence",
        title: "Keep the evidence specific to the service.",
        text: "NexSteps demonstrates FSS’s operational software work, including role-scoped access. It is not evidence of an AI deployment. A private AI proposal needs its own evaluation against your task and data.",
      },
      {
        id: "scope",
        title: "Include the cost of running the system.",
        text: "Hardware or hosting, model evaluation, integration, updates and support all affect scope. Compare those requirements with the expected use before committing to a build.",
      },
      {
        id: "risk",
        title: "Local deployment does not remove the need for oversight.",
        text: "AI outputs can be wrong. Access controls, logging, updates and review still need to be planned. Do not assume that a local deployment alone establishes privacy, security or regulatory compliance.",
      },
    ],
    faqs: [
      {
        question: "Does private AI always mean running on a laptop?",
        answer:
          "No. Options can include on-device processing or an organisation-controlled server. The suitable approach depends on the task, hardware, users and data boundaries.",
      },
      {
        question: "Can AI make safeguarding decisions?",
        answer:
          "This service does not propose replacing accountable human safeguarding judgement. Define human review and exclude consequential decisions from an automated workflow.",
      },
      {
        question: "What is needed before a deployment decision?",
        answer:
          "A defined use case, representative evaluation material, documented access requirements and an owner for maintenance and review.",
      },
    ],
  },
} satisfies Record<string, CommercialPageContent>;
