import type { ExampleService } from "../services";
export const plumbingServices: readonly ExampleService[] = [
  {
    slug: "leaks-and-repairs",
    title: "Leaks & plumbing repairs",
    description:
      "Find the source of dripping taps, leaking pipework and unreliable fixtures.",
    question: "What should I explain before a visit?",
    answer:
      "Describe where the water appears, when it started and whether it is continuous. Photographs from a safe position can help a plumber plan the assessment. A visible damp patch may be some distance from the source.",
    steps: [
      [
        "Describe the symptoms",
        "Explain the affected room, timing and any recent work.",
      ],
      [
        "Agree the assessment",
        "Confirm access, the initial visit charge and how additional work is authorised.",
      ],
      [
        "Understand the repair",
        "Ask what caused the issue, what will be replaced and how the repair will be checked.",
      ],
    ],
    preparation: [
      "A description of the affected area",
      "Safe photographs, if available",
      "Access restrictions and previous repairs",
    ],
  },
  {
    slug: "heating-care",
    title: "Heating & hot water",
    description:
      "Understand uneven warmth, unreliable hot water and the options for planned maintenance.",
    question: "Do I need a new heating system?",
    answer:
      "An assessment should establish the condition of the system and the cause of the problem before replacement is discussed. Ask for repair and replacement options, the scope of each and any required specialist qualifications.",
    steps: [
      [
        "Share your experience",
        "Note which rooms are affected and whether hot water is also unreliable.",
      ],
      [
        "Assess the system",
        "Discuss the existing equipment, maintenance history and controls.",
      ],
      [
        "Review the options",
        "Compare the proposed work, disruption and ongoing care before deciding.",
      ],
    ],
    preparation: [
      "Equipment make and model if accessible",
      "Any displayed fault message",
      "Recent service records",
    ],
  },
  {
    slug: "drainage",
    title: "Drainage investigations",
    description:
      "A structured assessment of slow drainage, recurring blockages and unexplained odours.",
    question: "Why does a blockage keep returning?",
    answer:
      "A recurring problem may require investigation beyond clearing the immediate obstruction. Ask whether a camera survey is appropriate and how the findings will be documented before agreeing to further work.",
    steps: [
      [
        "Map the symptoms",
        "Explain which fixtures are affected and how often the issue returns.",
      ],
      [
        "Investigate the cause",
        "Agree the inspection method and any access needed.",
      ],
      [
        "Plan the solution",
        "Review the findings and the proposed clearance or repair.",
      ],
    ],
    preparation: [
      "A history of previous blockages",
      "Locations of affected fixtures",
      "Known drainage access points",
    ],
  },
];
