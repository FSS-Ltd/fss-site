import type { CommercialPageContent } from "./types";
import {
  aiServiceLinks,
  costLink,
  nexstepsLink,
  resourceLink,
  sectorLink,
} from "./links";

const serviceDefaults = {
  kind: "service",
  modifiedDate: "2026-11-11",
  index: true,
  related: [sectorLink, nexstepsLink, costLink, resourceLink],
} as const;

const aiRelated = (path: string) =>
  [
    ...aiServiceLinks.filter((link) => link.href !== path),
    nexstepsLink,
    costLink,
    resourceLink,
  ] as const;

export const servicePages = {
  "/services/ai-integration": {
    ...serviceDefaults,
    related: aiRelated("/services/ai-integration"),
    path: "/services/ai-integration",
    label: "AI integration",
    title: "AI Integration Services for UK Businesses | FSS",
    description:
      "FSS adds AI to the systems your business already runs: CRM, email, documents and accounts. Scope the data, approvals and failure handling before any build.",
    heading: "Add AI to the tools your team already uses.",
    answer:
      "AI integration connects an AI model to the systems where your work already lives, such as your CRM, inbox, documents or accounting software, so it can read, draft and update records inside a process you control. FSS scopes the data it can see, the actions it may take and who approves them before building anything.",
    sections: [
      {
        id: "fit",
        title: "Who this is for.",
        text: "Businesses that already have systems holding the data and need AI to work inside them, not beside them. Typical starting points are triaging a shared inbox, drafting replies from CRM records, extracting fields from documents or summarising activity for a weekly report.",
      },
      {
        id: "notfit",
        title: "Who this is not for.",
        text: "If a feature inside your current software already does the job, use it. If the process is not yet written down, or nobody owns the data, settle that first.",
      },
      {
        id: "outcomes",
        title: "What the work involves.",
        text: "Integration work follows the route the data takes. We agree the task, then build and test it against real examples from your team.",
        points: [
          "Agree one task, its inputs, its outputs and who owns it",
          "Review the interfaces your systems offer and the permissions needed",
          "Build the connection and test it against representative records",
          "Run it alongside the manual process before it takes over",
        ],
      },
      {
        id: "evidence",
        title: "Operational software in practice.",
        text: "FSS built NexSteps, a safeguarding, attendance and operations platform, with role-scoped access and connected workflows. It is operational software, so it is no proof of AI work. An AI integration is assessed against your own task and data.",
      },
      {
        id: "scope",
        title: "What affects cost.",
        text: "Cost follows the number of systems involved, the quality of the interfaces they expose, the state of the data, how many exceptions the process has and how much review it needs. Model usage charges and ongoing support add running costs. These are worked through before a price is proposed.",
      },
      {
        id: "risk",
        title: "Approval, data handling and failure cases.",
        text: "Decide which actions the AI may take alone and which wait for a person. Limit what data it can read, record what it did, and plan for wrong answers, unavailable services and changed models. Agree who is alerted when a run fails and how it is retried or reversed.",
      },
    ],
    faqs: [
      {
        question: "Can we keep our current tools and add AI to them?",
        answer:
          "It depends on whether your tools offer supported interfaces and permissions for the data involved. Checking that is the first step of scoping, before any promise of integration.",
      },
      {
        question: "Will it integrate with our CRM and booking system?",
        answer:
          "That depends on the systems you use and what they expose. Tell us which tools hold the records and we will establish what can be read and written before agreeing the work.",
      },
      {
        question:
          "Should we use an AI feature inside our software or a custom integration?",
        answer:
          "Start with the built-in feature if it covers the task. A custom integration makes sense when the task crosses several systems or needs rules your software does not offer.",
      },
      {
        question: "What happens when the AI model or its pricing changes?",
        answer:
          "Build the integration so the model can be swapped and usage can be monitored. Agree who reviews model changes and pricing, and test outputs again after any change.",
      },
      {
        question: "Who owns the prompts and the code?",
        answer:
          "Agree ownership of code, prompts and configuration in writing before work starts, so you are not dependent on one supplier to keep the system running.",
      },
    ],
  },
  "/services/ai-agents": {
    ...serviceDefaults,
    related: aiRelated("/services/ai-agents"),
    path: "/services/ai-agents",
    label: "AI agents for business",
    title: "AI Agents for Business, Built in the UK | FSS",
    description:
      "FSS builds AI agents that handle defined back-office tasks, such as email triage or quote follow-up, with approval steps, logs and a route for failures.",
    heading: "AI agents that do one job and ask before anything risky.",
    answer:
      "An AI agent is software that takes a defined task, decides the next step and uses your tools to carry it out, for example sorting incoming email or chasing a quote. FSS builds agents around one narrow job, with approval steps, activity logs and a clear route when the agent cannot proceed.",
    sections: [
      {
        id: "fit",
        title: "Who this is for.",
        text: "Teams with repeated, rule-based back-office work that a person currently does by reading, deciding and typing. Examples include email triage, quote follow-up, invoice chasing and preparing a summary from several sources.",
      },
      {
        id: "notfit",
        title: "Who this is not for.",
        text: "A fixed sequence with no judgement involved is workflow automation and needs no agent. Work where a mistake is costly and cannot be reviewed is a poor starting point. Pre-built agents inside tools you already pay for may be enough, so check them first.",
      },
      {
        id: "outcomes",
        title: "What the work involves.",
        text: "We define the job narrowly, then build, test and supervise it before it gains any independence.",
        points: [
          "A written description of the task, its inputs and what done means",
          "The tools the agent may use and the limits on each",
          "Approval steps for any action that affects people, money or records",
          "Logs of what it read, decided and did",
        ],
      },
      {
        id: "evidence",
        title: "Operational software in practice.",
        text: "FSS built NexSteps, an operations platform with role-scoped access and handover logs. It shows how we design permissions and records. It is not an AI deployment, and an agent proposal is tested against your own task.",
      },
      {
        id: "scope",
        title: "What affects cost.",
        text: "Cost follows the number of tools the agent touches, how many exceptions the task has, how much testing it needs and how often a person must approve. Model usage charges, monitoring and support continue after launch. Estimate those running costs before choosing the build.",
      },
      {
        id: "risk",
        title: "Approval, data handling and failure cases.",
        text: "An agent can be wrong or act on bad input. Keep a person approving consequential actions, restrict the data it can reach and keep an audit trail. Plan for what happens when it is unsure, when a tool is down and when it repeats an action, and decide who is alerted.",
      },
    ],
    faqs: [
      {
        question: "Do consequential AI actions need a human approval step?",
        answer:
          "For anything affecting people, money or sensitive records, yes. We design the approval point into the process, and an agent can be limited to drafting for a person to send.",
      },
      {
        question: "Should we use pre-built agents or a custom one?",
        answer:
          "Try the pre-built agent in your existing software first. Custom work earns its cost when the task spans several systems or needs your own rules and approvals.",
      },
      {
        question: "Will usage charges come in higher than expected?",
        answer:
          "They can. Estimate volume before building, set usage limits and review spend in the first weeks so a surprise is caught early rather than on an invoice.",
      },
      {
        question: "Who owns the prompts and agent definitions?",
        answer:
          "Settle this in the contract before work starts. Ownership of prompts, agent definitions and code should be written down, with the system documented for handover.",
      },
      {
        question: "What happens when the AI model or its pricing changes?",
        answer:
          "Models change. Build so the model can be replaced, test outputs again after a change and agree who monitors announcements and usage costs.",
      },
    ],
  },
  "/services/ai-receptionist": {
    ...serviceDefaults,
    related: aiRelated("/services/ai-receptionist"),
    path: "/services/ai-receptionist",
    label: "AI receptionist",
    title: "AI Receptionist for Small Business UK | FSS",
    description:
      "FSS sets up an AI receptionist that answers calls and messages, takes details and books appointments, with a clear handover to your staff when it cannot help.",
    heading: "Answer every enquiry, and hand over when a person is needed.",
    answer:
      "An AI receptionist answers calls and messages when your team cannot, collects the caller's details and, where connected, books into your diary. FSS sets one up around what your business actually handles and agrees in advance when it passes the conversation to a person.",
    sections: [
      {
        id: "fit",
        title: "Who this is for.",
        text: "Owner-led and small businesses that lose enquiries to missed calls, after-hours messages or a busy front desk. Typical fits include trades, clinics, local services and professional practices, covering after-hours only or the busiest periods.",
      },
      {
        id: "notfit",
        title: "Who this is not for.",
        text: "If a low-cost off-the-shelf service covers your calls, use it. If most calls are sensitive, urgent or need judgement, an automated voice is a poor fit. A business with very few calls may not need one.",
      },
      {
        id: "outcomes",
        title: "What the work involves.",
        text: "The receptionist is only as good as what it knows about your business, so most of the work is preparing that and testing it.",
        points: [
          "List the questions callers ask and the answers you approve",
          "Decide what it may do: take messages, book, or pass on",
          "Connect your diary, CRM or booking tool where that is supported",
          "Test with real call scenarios before it answers a live line",
        ],
      },
      {
        id: "evidence",
        title: "Operational software in practice.",
        text: "FSS built NexSteps, an operations platform with parent onboarding and role-scoped access. It is operational software rather than an AI deployment, so a receptionist is tested against your own calls and diary.",
      },
      {
        id: "scope",
        title: "What affects cost.",
        text: "Cost follows call volume, the number of services and questions covered, the systems it must connect to, any voice or language needs and how much testing the script needs. Platform and usage fees recur monthly. A worked comparison with the value of a missed enquiry helps the decision.",
      },
      {
        id: "risk",
        title: "Approval, data handling and failure cases.",
        text: "Callers should know they are speaking to an AI, and it should not guess answers it has not been given. Decide what is recorded and how long it is kept, who reviews call logs, and the handover route when it cannot answer or the caller asks for a person.",
      },
    ],
    faqs: [
      {
        question: "Does it know enough about my business?",
        answer:
          "Only what you give it. We build the answers from your own services, hours and policies, test them with real questions and extend them as gaps appear.",
      },
      {
        question: "What happens when it cannot answer a question?",
        answer:
          "It should say so and pass the caller to a person or take a message. We agree that handover with you and test it before the line goes live.",
      },
      {
        question: "Can it answer several calls at once?",
        answer:
          "That depends on the platform chosen. Confirm the concurrency limit for your expected call volume before committing.",
      },
      {
        question: "Are AI receptionists GDPR compliant?",
        answer:
          "FSS cannot certify compliance. It depends on what is recorded, where it is stored and for how long. Every build comes with a written data-flow description for your own assessment. This is not legal advice.",
      },
      {
        question: "Will it connect to our CRM and booking system?",
        answer:
          "Where your tools offer supported interfaces, yes. Tell us what you use and we will confirm what can be connected before agreeing the work.",
      },
    ],
  },
  "/services/ai-readiness-audit": {
    ...serviceDefaults,
    related: aiRelated("/services/ai-readiness-audit"),
    path: "/services/ai-readiness-audit",
    label: "AI readiness audit",
    title: "AI Readiness Assessment for UK Businesses | FSS",
    description:
      "Not sure where AI fits? FSS reviews your processes, data and tools, then advises what to automate first, what to leave alone and what to fix before a build.",
    heading: "Find out where AI fits before you pay to build it.",
    answer:
      "An AI readiness audit reviews your processes, data and tools to find where AI could help, where it would not and what needs fixing first. FSS produces a written recommendation you can act on with us or with anyone else, and it may conclude that AI is not the right step yet.",
    sections: [
      {
        id: "fit",
        title: "Who this is for.",
        text: "Businesses that want to use AI but do not know where to start, and teams with a stalled pilot or a long list of ideas with no order. It suits owners and operations leads who need a decision they can defend.",
      },
      {
        id: "notfit",
        title: "Who this is not for.",
        text: "If you already know the single task you want built, scope that task directly. If you want a vendor to pick a tool before anyone has looked at your processes, this is not that.",
      },
      {
        id: "outcomes",
        title: "What the work involves.",
        text: "We look at how work moves through your business, then test the best candidates for fit with the data you hold.",
        points: [
          "Map a handful of repeated processes with the people who do them",
          "Check where the data lives, who owns it and how clean it is",
          "Compare candidate tasks for benefit, risk and effort",
          "Write up a ranked recommendation, including what to fix first",
        ],
      },
      {
        id: "evidence",
        title: "Operational software in practice.",
        text: "FSS built NexSteps, an operations platform, which shaped how we examine workflows, data and access. It is operational software, not an AI project. The audit assesses your own processes and data.",
      },
      {
        id: "scope",
        title: "What affects cost.",
        text: "Cost follows how many processes and systems are reviewed, how many people we need to speak to and how much data access is needed. Decide the boundary of the review first. The output is a ranked list of candidate tasks, the data problems blocking each and a recommendation on what to build, fix or leave alone. The assessment can conclude that no build is needed.",
      },
      {
        id: "risk",
        title: "Approval, data handling and failure cases.",
        text: "The review should need only limited access, and anonymised samples where possible. Agree who sees what, how any data is handled and returned, and who signs off the findings. If the audit finds AI is not worth it yet, that is a valid result.",
      },
    ],
    faqs: [
      {
        question:
          "I want to use AI but do not know where to start. Is this for me?",
        answer:
          "Yes. This is the starting point for exactly that. We review where your team spends time and recommend an order of work rather than a tool.",
      },
      {
        question: "What should we automate first?",
        answer:
          "A repeated process with a clear owner, known inputs and checkable results. The audit tests your candidates against those criteria and ranks them.",
      },
      {
        question: "Do we need to fix our data before using AI?",
        answer:
          "Some of it. Poor or scattered data limits what AI can do. The audit shows which data problems block which tasks, so you fix what matters first.",
      },
      {
        question: "Does an assessment come before a fixed quote?",
        answer:
          "For anything unclear, yes. Pricing a build before the task and data are understood invites surprises, so the assessment sets out the task, the data and the open questions in writing.",
      },
      {
        question: "Is AI safe for my business?",
        answer:
          "It depends on the task, the data it touches and the approvals around it. The audit identifies where more controls are needed before anything is built.",
      },
    ],
  },
  "/services/custom-software-development": {
    ...serviceDefaults,
    path: "/services/custom-software-development",
    label: "Custom software development",
    title: "Custom Software Development UK | FSS",
    description:
      "Bespoke business software built by FSS around your workflows, permissions and integrations, from spreadsheet replacement to systems ready to support AI later.",
    heading: "Custom software built around the way your business works.",
    answer:
      "FSS builds bespoke software for businesses of any size when existing tools cannot support the way their teams work. We define the workflows, people and data involved before agreeing a first release, and we design the system so AI can be added to it later.",
    sections: [
      {
        id: "fit",
        title: "When the work no longer fits a spreadsheet.",
        text: "This service is for operations leads who need people, records and decisions to move through a shared system. Repeated data entry, unclear ownership and reports assembled by hand are good starting points for discovery.",
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
        text: "FSS built NexSteps, a safeguarding, attendance and operations platform for schools and community organisations. Its role-scoped access and parent onboarding provide a concrete example of this kind of work. It is not evidence of AI work.",
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
          "When an important workflow cannot be supported adequately by configuring existing tools, and your business can own the ongoing operation and maintenance of the system.",
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
    title: "Client Portal Development for UK Businesses | FSS",
    description:
      "Plan and build client, customer and staff portals with FSS. Define onboarding, role-based access and the workflows people complete inside your portal.",
    heading: "A clear place for people to access the work that concerns them.",
    answer:
      "FSS develops portals for businesses that need clients, customers or staff to complete tasks and see relevant information. The starting point is who needs access, what they need to do and which records they should be able to see.",
    sections: [
      {
        id: "fit",
        title: "Give repeated requests a defined route.",
        text: "A portal can suit teams handling onboarding, document requests or updates across email and spreadsheets. Map those tasks before adding a new place for people to sign in.",
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
        text: "NexSteps includes role-scoped access, support portals and parent onboarding. FSS built these alongside its safeguarding, attendance and operational workflows. These are operational software features, not AI work.",
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
        question: "Does every client need an account?",
        answer:
          "Not necessarily. Identify which tasks need authenticated access and which can be completed without an account before designing onboarding.",
      },
    ],
  },
  "/services/workflow-automation": {
    ...serviceDefaults,
    path: "/services/workflow-automation",
    label: "Workflow automation",
    title: "Business Process Automation UK | FSS",
    description:
      "Connect your business tools and cut repeated manual data entry with FSS. Scope process automation with human review, exception handling and AI where useful.",
    heading: "Connect the steps your team keeps repeating.",
    answer:
      "FSS helps businesses automate defined operational workflows between their existing tools. We map the trigger, data, decisions and exceptions so routine work can move forward with human review where judgement matters, and with AI added only where it earns its place.",
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
        text: "FSS-built NexSteps includes parent onboarding and billing workflows alongside attendance and safeguarding handover logs. These are examples of operational tasks being designed as part of a wider system. NexSteps is not an AI deployment.",
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
    title: "Legacy System Modernisation UK | FSS",
    description:
      "Assess and modernise ageing business software with FSS. Plan data migration, integrations, testing and handover so the next system can also support AI work.",
    heading: "Move an existing system forward with a clear migration plan.",
    answer:
      "FSS helps businesses assess and modernise software that has become difficult to maintain or adapt. We examine what needs to keep working, what can change and how records and users will move to the next version, so the system can also support AI later.",
    sections: [
      {
        id: "fit",
        title: "Understand what the current system still does well.",
        text: "For operations teams, an older system may hold years of records and established routines. Document those dependencies before choosing an upgrade, targeted replacement or broader rebuild.",
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
        text: "FSS built NexSteps for safeguarding, attendance and community operations. It illustrates our operational software work; it is not presented as a legacy migration case study or an AI deployment.",
      },
      {
        id: "scope",
        title: "Assessment comes before a replacement estimate.",
        text: "Source access, data formats, integrations and undocumented behaviours affect effort. A scoped assessment can establish the work needed before the business commits to a migration.",
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
    title: "Private AI for Business: Local or Self-Hosted | FSS",
    description:
      "Assess private, local or self-hosted AI for your business with FSS. Define data boundaries, hardware needs, evaluation and human oversight before you deploy.",
    heading: "Assess private AI against the work and the data it will handle.",
    answer:
      "FSS helps businesses assess whether local, on-device or self-hosted AI fits a defined task. We consider data boundaries, hardware, access, model quality and ongoing operation before recommending a deployment approach.",
    sections: [
      {
        id: "fit",
        title: "Begin with a narrow task.",
        text: "Businesses considering document search or drafting assistance need to define the source material and who may use it. Establish whether AI is useful for the task before choosing where it runs.",
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
