import type { ExampleService } from "../services";
export const accountsServices: readonly ExampleService[] = [
  {
    slug: "bookkeeping",
    title: "Bookkeeping for independent businesses",
    description:
      "Put a dependable routine around records, receipts and the numbers you use each month.",
    question: "What should I bring to a first bookkeeping conversation?",
    answer:
      "An overview of your current system, the volume of transactions and where the records are stored is a useful start. You do not need to send passwords or financial account access through an enquiry form.",
    steps: [
      [
        "Understand your current routine",
        "Discuss how sales, purchases and records move through the business.",
      ],
      [
        "Agree responsibilities",
        "Be clear about what you will provide, who will do the work and when.",
      ],
      [
        "Build a useful rhythm",
        "Set a regular review that keeps records organised and questions manageable.",
      ],
    ],
    preparation: [
      "The tools you currently use",
      "Your approximate transaction volume",
      "The tasks that take the most time",
    ],
  },
  {
    slug: "accounts-and-reporting",
    title: "Accounts and business reporting",
    description:
      "Make the reporting conversation clear, from the records needed to the questions worth asking.",
    question: "How are annual accounts different from management reports?",
    answer:
      "Annual accounts and regular management reports serve different purposes. A first discussion can clarify the reporting your business requires and the additional information that would support everyday decisions.",
    steps: [
      [
        "Clarify the brief",
        "Discuss your business structure, existing arrangements and reporting requirements.",
      ],
      [
        "Organise the information",
        "Agree the records needed and how outstanding questions will be resolved.",
      ],
      [
        "Explain what the numbers mean",
        "Make space for a conversation about trends, assumptions and the next decisions.",
      ],
    ],
    preparation: [
      "Your business structure",
      "Known reporting dates or upcoming deadlines",
      "Questions you want the numbers to answer",
    ],
  },
  {
    slug: "cash-flow-planning",
    title: "Cash-flow planning and clarity",
    description:
      "Explore the timing of money in and money out, with the assumptions kept in view.",
    question: "Is a cash-flow forecast a guarantee?",
    answer:
      "No. A forecast depends on assumptions about timing, income and spending. Its usefulness comes from making those assumptions visible, reviewing alternatives and updating the picture as circumstances change.",
    steps: [
      [
        "Start with the timing",
        "Look at when receipts and payments are expected, not only their totals.",
      ],
      [
        "Explore alternatives",
        "Consider how slower receipts or changed costs could affect the plan.",
      ],
      [
        "Review and adjust",
        "Keep the forecast connected to what is actually happening in the business.",
      ],
    ],
    preparation: [
      "The decisions you are considering",
      "A view of your recurring commitments",
      "The timing uncertainties that concern you",
    ],
  },
];
