import type { ExampleService } from "../services";
export const electricalServices: readonly ExampleService[] = [
  {
    slug: "fault-finding",
    title: "Electrical fault finding",
    description:
      "An organised approach to intermittent power, tripping circuits and unreliable fittings.",
    question: "What information helps with a fault?",
    answer:
      "Explain what changed, which areas are affected and when the problem occurs. Do not remove covers or attempt repairs. A contractor can use your observations to plan a suitable professional investigation.",
    steps: [
      [
        "Describe the fault",
        "Share the timing, affected rooms and any recent alterations.",
      ],
      [
        "Agree the investigation",
        "Confirm the diagnostic charge and access requirements.",
      ],
      [
        "Review the findings",
        "Understand the cause and proposed repair before authorising additional work.",
      ],
    ],
    preparation: [
      "A description of the symptoms",
      "Recent work or appliance changes",
      "Access to the affected areas",
    ],
  },
  {
    slug: "electrical-inspections",
    title: "Electrical inspections",
    description:
      "Understand the condition of an installation with a clearly scoped professional inspection.",
    question: "What happens after an inspection?",
    answer:
      "Ask for the findings to be explained in plain language, including any recommended actions and their priority. The inspection scope, access limitations and any further investigation should be recorded clearly.",
    steps: [
      [
        "Define the scope",
        "Discuss the property, purpose of the inspection and existing records.",
      ],
      [
        "Plan access",
        "Agree access, expected interruption and arrangements for occupants.",
      ],
      [
        "Discuss the report",
        "Review the findings and obtain a separate scope for any remedial work.",
      ],
    ],
    preparation: [
      "Previous electrical reports",
      "Property plans if available",
      "Occupancy and access information",
    ],
  },
  {
    slug: "lighting-and-installation",
    title: "Lighting & installation",
    description:
      "Plan practical lighting, additional sockets and electrical work around how you use a space.",
    question: "When should I involve an electrician?",
    answer:
      "Early discussion helps coordinate electrical work with cabinetry, decoration and other trades. Share how each room will be used and the fittings you are considering so the design can be assessed before installation.",
    steps: [
      [
        "Build the brief",
        "Describe activities, furniture positions and desired lighting.",
      ],
      [
        "Agree the design",
        "Review positions, controls, specification and making-good responsibilities.",
      ],
      [
        "Plan the handover",
        "Confirm testing, relevant documentation and a walkthrough of the controls.",
      ],
    ],
    preparation: [
      "Room layouts and design ideas",
      "Details of proposed fittings",
      "Renovation schedule and other trades",
    ],
  },
];
