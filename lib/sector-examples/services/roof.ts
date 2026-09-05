import type { ExampleService } from "../services";
export const roofServices: readonly ExampleService[] = [
  {
    slug: "roof-repairs",
    title: "Roof repairs in Kent",
    description:
      "Understand a leak, damaged tile or weather-related concern before deciding on the work.",
    question: "Does a leak mean I need a new roof?",
    answer:
      "Not necessarily. Water can enter around individual tiles, flashing or roof junctions. An inspection should establish the cause and explain the repair options before proposing larger work.",
    steps: [
      [
        "Describe what you’ve noticed",
        "Share when the problem began, which room is affected and whether it changes with the weather.",
      ],
      [
        "Arrange a safe inspection",
        "Discuss access and arrange a professional assessment of the affected area.",
      ],
      [
        "Review the proposed repair",
        "Ask for the scope, materials, access requirements and any limitations to be explained in writing.",
      ],
    ],
    preparation: [
      "Photographs taken safely from ground level",
      "A note of when the issue started",
      "Any previous roof work you know about",
    ],
  },
  {
    slug: "new-roofs",
    title: "New and replacement roofs",
    description:
      "A clear plan for the structure, materials and finishing details above your home.",
    question: "How do I choose a roof covering?",
    answer:
      "The pitch, structure, surrounding buildings and any relevant planning constraints affect the options. Discuss both appearance and suitability, and ask how the chosen covering will work with the rest of the roof.",
    steps: [
      [
        "Assess the whole roof",
        "Review the existing structure and covering, rather than treating each symptom in isolation.",
      ],
      [
        "Agree the specification",
        "Understand the materials, ventilation, insulation interfaces and finishing details.",
      ],
      [
        "Plan the sequence",
        "Discuss access, scaffolding, weather contingencies and how the site will be left each day.",
      ],
    ],
    preparation: [
      "Plans or drawings if you have them",
      "The reasons you’re considering replacement",
      "Your preferred timing and access constraints",
    ],
  },
  {
    slug: "flat-roofs",
    title: "Flat roofs and roofline care",
    description:
      "Thoughtful attention to surfaces, drainage and the edges that help protect a property.",
    question: "What should a flat-roof assessment cover?",
    answer:
      "The surface is only part of the picture. An assessment should consider the deck, falls, drainage, upstands and junctions, and explain whether a local repair or broader work is appropriate.",
    steps: [
      [
        "Look beyond the surface",
        "Discuss pooling water, internal marks and the age or history of the roof.",
      ],
      [
        "Understand the options",
        "Compare the proposed approach, preparation and maintenance needs.",
      ],
      [
        "Keep the detail clear",
        "Agree the treatment of outlets, edges and connections to the building.",
      ],
    ],
    preparation: [
      "Approximate age of the roof if known",
      "Any previous repair information",
      "Safe access arrangements",
    ],
  },
];
