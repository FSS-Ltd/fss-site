import type { ExampleService } from "../services";
export const landscapeServices: readonly ExampleService[] = [
  {
    slug: "garden-design",
    title: "Garden design in Kent",
    description:
      "A complete spatial plan that connects your home, everyday routines and the character of the site.",
    question: "What happens before the first design is drawn?",
    answer:
      "A designer needs to understand your priorities, the site and a realistic working budget. Depending on the project, a measured survey and specialist input may be needed. Agree what is included in the design fee and which surveys or approvals are separate.",
    steps: [
      [
        "Understand the site",
        "Discuss how the garden is used, access, light, levels, existing trees and practical constraints.",
      ],
      [
        "Develop the concept",
        "Review a proposed layout with the materials, planting character and everyday use explained.",
      ],
      [
        "Prepare for delivery",
        "Agree the drawings and specifications needed for contractor pricing and whether site support is included.",
      ],
    ],
    preparation: [
      "A site address and recent photographs",
      "Any existing plans or surveys",
      "Priorities, working budget and desired timing",
    ],
  },
  {
    slug: "planting-design",
    title: "Planting design and seasonal structure",
    description:
      "Plant combinations shaped by soil, light and the amount of care you want to give the garden.",
    question: "Can planting improve an existing garden without rebuilding it?",
    answer:
      "Often it can. Assess the existing plants and soil first, then decide what to retain, move or replace. A planting plan should explain spacing, establishment and ongoing care, with realistic expectations for growth over time.",
    steps: [
      [
        "Assess growing conditions",
        "Look at soil, sun, shade, exposure and the health of existing planting.",
      ],
      [
        "Build a plant palette",
        "Balance structure, flowering periods and texture with the time available for care.",
      ],
      [
        "Plan establishment",
        "Discuss sourcing, planting windows, watering and how the planting will develop.",
      ],
    ],
    preparation: [
      "Photographs across the garden",
      "Notes on light and existing plants",
      "Maintenance preferences and planting budget",
    ],
  },
  {
    slug: "landscape-design-and-delivery",
    title: "Landscape design and delivery support",
    description:
      "Carry the design into a clear specification and an organised conversation with the people building it.",
    question: "Does the design service include construction?",
    answer:
      "Design and construction are distinct scopes. Ask whether the studio appoints contractors, assists with tendering or makes site visits, and who manages the building contract. Specialist drainage, structural or planning advice may be separate.",
    steps: [
      [
        "Define the deliverables",
        "Agree drawings, material details, planting schedules and the specialist advice required.",
      ],
      [
        "Compare like-for-like proposals",
        "Use a consistent scope so contractor pricing can be understood and questions resolved.",
      ],
      [
        "Support the build",
        "Agree how site queries, substitutions and changes will be reviewed and recorded.",
      ],
    ],
    preparation: [
      "Existing design or architectural information",
      "Target construction window",
      "Known site access and project constraints",
    ],
  },
];
