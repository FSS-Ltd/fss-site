import type { ExampleService } from "../services";
export const estateServices: readonly ExampleService[] = [
  {
    slug: "selling-your-home",
    title: "Selling your home in Kent",
    description:
      "From the first valuation conversation to a clear plan for presenting your property.",
    question: "What should I ask at a valuation?",
    answer:
      "Ask about comparable homes, the recommended asking price, fees, the proposed marketing, the contract and how viewings and feedback will be managed. A useful valuation explains the reasoning behind the figures.",
    steps: [
      [
        "Start with your plans",
        "Discuss your timing, onward move and what matters most about the sale.",
      ],
      [
        "Prepare the presentation",
        "Agree photography, floor plans and the details buyers need to understand the home.",
      ],
      [
        "Stay informed",
        "Set expectations for viewing updates, offers and communication as the sale progresses.",
      ],
    ],
    preparation: [
      "Your intended moving timeframe",
      "Details of improvements or alterations",
      "Questions about fees and the agency agreement",
    ],
  },
  {
    slug: "buying-a-home",
    title: "Finding and viewing a home",
    description:
      "Narrow the search around what matters, then make the most of each viewing.",
    question: "How can I make a viewing more useful?",
    answer:
      "Look beyond the furniture. Consider natural light, storage, the layout and the surrounding area. Write down questions and revisit important details before deciding on an offer.",
    steps: [
      [
        "Set your priorities",
        "Separate essentials from preferences, including location, space and connections.",
      ],
      [
        "Plan the viewing",
        "Ask about the property’s position, availability and practical details before visiting.",
      ],
      [
        "Talk through the next step",
        "Understand the process for questions, an offer and any further professional checks.",
      ],
    ],
    preparation: [
      "Your preferred areas and budget",
      "The features you can’t compromise on",
      "Your current position and likely timing",
    ],
  },
  {
    slug: "letting-your-property",
    title: "Letting your property",
    description:
      "A considered introduction to finding tenants and choosing the right level of support.",
    question: "What should I clarify before instructing a letting agent?",
    answer:
      "Ask exactly what is included: marketing, tenant enquiries, reference coordination, documentation and ongoing management. Responsibilities, fees and any separately charged services should be clear before you proceed.",
    steps: [
      [
        "Discuss the property",
        "Review the home, intended availability and the support you need.",
      ],
      [
        "Choose the service",
        "Compare tenant-find and management arrangements, with responsibilities clearly explained.",
      ],
      [
        "Prepare for letting",
        "Agree the next checks and preparation with the relevant qualified professionals.",
      ],
    ],
    preparation: [
      "Property type and intended availability",
      "Your preferred level of management support",
      "Any current tenancy or property documentation",
    ],
  },
];
