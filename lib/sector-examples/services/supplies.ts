import type { ExampleService } from "../services";
export const suppliesServices: readonly ExampleService[] = [
  {
    slug: "office-supply-quotes",
    title: "Comparing office supply quotes",
    description:
      "Compare the whole basket, including pack sizes, specifications and delivery.",
    question: "Why do two quotes for the same list look different?",
    answer:
      "Product descriptions can conceal different pack sizes, paper weights or alternative brands. Compare the specification and unit count, then check delivery charges and the treatment of VAT. Ask the supplier to identify substitutions so you can decide whether they meet the same need.",
    steps: [
      [
        "Make the list specific",
        "Include product references where available, required quantities and specifications that matter.",
      ],
      [
        "Compare like for like",
        "Review units per pack, materials and alternative products alongside the quoted price.",
      ],
      [
        "Confirm the whole cost",
        "Clarify delivery, VAT, availability and how long the quote remains valid before placing an order.",
      ],
    ],
    preparation: [
      "Your product list and quantities",
      "Any essential brand or specification requirements",
      "Delivery location and preferred timing",
    ],
  },
  {
    slug: "office-setup-supplies",
    title: "Planning an office supply order",
    description:
      "Build a useful essentials list around people, tasks and the space available.",
    question: "Where should a new office supply list start?",
    answer:
      "Start with the work people need to do. Separate individual desk items from shared supplies, then consider printing, meetings and storage. Ask colleagues what they use before buying in volume, and check equipment compatibility for items such as printer consumables.",
    steps: [
      [
        "Map the working day",
        "List the tasks, workspaces and shared areas you need to support.",
      ],
      [
        "Set the quantities",
        "Account for the number of users, storage capacity and expected rate of use.",
      ],
      [
        "Check compatibility",
        "Confirm sizes and product references for consumables before agreeing the order.",
      ],
    ],
    preparation: [
      "Number of workspaces and shared areas",
      "Printer model details where relevant",
      "Items already available or due to be reused",
    ],
  },
  {
    slug: "recurring-office-orders",
    title: "Managing recurring office orders",
    description:
      "Make replenishment easier with a clear list and agreed purchasing responsibilities.",
    question: "How can we reduce last-minute supply orders?",
    answer:
      "Keep a simple record of regularly used items and who checks them. Review consumption before setting replenishment quantities, and agree who can approve changes or alternatives. Delivery arrangements and availability should be confirmed with the supplier rather than assumed.",
    steps: [
      [
        "Identify the repeat items",
        "Use previous orders and team feedback to establish the recurring essentials.",
      ],
      [
        "Agree the process",
        "Decide who checks stock, requests the quote and approves the purchase.",
      ],
      [
        "Review the pattern",
        "Adjust quantities as usage, headcount or working arrangements change.",
      ],
    ],
    preparation: [
      "A recent list of regular purchases",
      "Your purchasing approval process",
      "Any restrictions on deliveries or storage",
    ],
  },
];
