import type {
  WelcomePackContent,
  WelcomePackId,
} from "./welcome-pack-contract";

export function designedPacketGuide(
  packId: WelcomePackId,
): WelcomePackContent["guide"] {
  const portal = packId === "systems_portal";
  const seo = packId === "website_seo";
  return [
    {
      sectionId: "welcome",
      layout: "image_top",
      imageId: "human_craft",
      title: "Welcome and your guide",
      paragraphs: [
        "Hello {{contact_first_name}}. This guide gives {{client_name}} a practical starting point for the work ahead. We will make decisions against your agreed priorities and confirm details with you before delivery begins.",
        "Inside: project summary (3), service overview (4), our process (5), milestone timeline (6), your responsibilities (7), deliverables (8), communication (9), and next steps (10).",
        "Your agreement sets the services, fees and terms. This guide supports that agreement and does not add commitments.",
      ],
    },
    {
      sectionId: "project",
      layout: "image_left",
      imageId: "mission_systems",
      title: "Your project at a glance",
      paragraphs: [
        "Client: {{client_name}}. Your project contact: {{contact_first_name}}. FSS contact: {{sender_name}}.",
        "The goal: {{agreement_goal}}.",
        "The proposed scope: {{agreement_scope}}.",
        "Kickoff: To be agreed. First review: To be agreed. Delivery: To be agreed. We will confirm dates after the required decisions, materials and access are ready.",
      ],
    },
    {
      sectionId: "services",
      layout: "image_right",
      imageId: portal ? "community_portal" : "workflow",
      title: "Your service overview",
      paragraphs: [
        portal
          ? "We will confirm the portal's users, roles, data and integrations before implementation. The agreed workflows and permission boundaries guide the build."
          : "We will confirm your website's structure, content and design direction before development. The agreement defines the pages, functionality and launch support included.",
        seo
          ? "Where included, we will establish the SEO starting point using authorised search and analytics access. Ongoing work and reporting follow the service scope agreed with you."
          : "Each service is limited to the agreed scope. If a new requirement appears, we will discuss its effect on effort, fees and dates before adding it.",
        "The scope we will review together: {{agreement_scope}}.",
      ],
    },
    {
      sectionId: "process",
      layout: "process",
      imageId: "workflow",
      title: "How the work moves forward",
      paragraphs: [
        "Discover: confirm priorities, inputs and the people who will approve decisions.",
        "Define: agree the structure, design direction and acceptance criteria.",
        portal
          ? "Build: implement the agreed workflows, permissions and integrations in reviewed stages."
          : "Build: develop the agreed pages and features using the approved content and direction.",
        "Review: check the work together, record feedback and confirm what meets the agreed criteria.",
        "Deliver: complete the agreed handover and confirm the next operational steps.",
      ],
    },
    {
      sectionId: "timeline",
      layout: "timeline",
      imageId: "mission_systems",
      title: "Milestones and review points",
      paragraphs: [
        "Kickoff and inputs confirmed: To be agreed.",
        "Structure and direction approved: To be agreed.",
        "First working review: To be agreed.",
        "Final review and handover: To be agreed.",
        seo
          ? "SEO baseline and reporting cadence: To be agreed."
          : "Follow-up arrangements: To be agreed.",
        "Dates depend on the signed scope, agreed prerequisites and feedback. We will discuss changes with you and confirm the revised plan.",
      ],
    },
    {
      sectionId: "responsibilities",
      layout: "image_left",
      imageId: "human_craft",
      title: "What we need from you",
      paragraphs: [
        "Nominate a project contact and the people authorised to approve the work. Consolidate feedback so we can act on clear decisions.",
        portal
          ? "Prepare the agreed user roles, authorised sample data and integration access. Confirm which information is sensitive and use the approved secure sharing route."
          : "Prepare approved copy, brand assets and authorised access listed in the agreement. Confirm that you have permission to use supplied materials.",
        seo
          ? "Provide the agreed search and analytics permissions. Do not send account passwords by email."
          : "Do not send passwords by email. Your FSS contact will confirm the secure route for credentials and project information.",
        "Review requests at the agreed points and tell us promptly when an input or decision needs more time.",
      ],
    },
    {
      sectionId: "deliverables",
      layout: "image_right",
      imageId: portal ? "community_portal" : "workflow",
      title: "What you will receive",
      paragraphs: [
        "The agreed deliverables: {{agreement_scope}}.",
        portal
          ? "The handover covers the portal features, roles and operating instructions included in your agreement. We will review acceptance criteria with the nominated stakeholders."
          : "The handover covers the website pages, functionality and operating instructions included in your agreement. We will review the agreed launch checks together.",
        seo
          ? "SEO work and reports follow the agreed scope and reporting cadence. Search outcomes are reviewed using the agreed baseline; specific rankings or results are not promised."
          : "We will record agreed changes and confirm how they affect delivery. Any ongoing support follows the service terms agreed separately.",
      ],
    },
    {
      sectionId: "communication",
      layout: "image_top",
      imageId: "human_craft",
      title: "Keeping the work clear",
      paragraphs: [
        "Your FSS contact is {{sender_name}}. Reply to project emails when you need clarification, and use the client workspace for the agreed reviews, requests and documents.",
        "We will confirm the update rhythm, response expectations and review arrangements at kickoff. If a decision changes the scope or schedule, we will record it for agreement.",
        "Keep sensitive information in the approved secure channel. If access fails or an urgent issue affects delivery, tell your FSS contact so we can agree the next step.",
      ],
    },
    {
      sectionId: "next_steps",
      layout: "image_right",
      imageId: "mission_systems",
      title: "Your next steps",
      paragraphs: [
        "Read the proposal when it arrives. Check the scope, fees, payment schedule and responsibilities before signing.",
        "Confirm your project contact and prepare the requested inputs in your checklist. Use only the secure sharing method agreed with FSS.",
        "We will confirm kickoff and milestone dates after the agreed prerequisites are complete. Until then: To be agreed.",
        "If this guide misses a priority, reply to {{sender_name}} so we can confirm the plan together.",
      ],
    },
  ];
}
