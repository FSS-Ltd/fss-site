import type { ExampleService } from "../services";
export const hospitalityServices: readonly ExampleService[] = [
  {
    slug: "restaurant-and-table-bookings",
    title: "Restaurant and table bookings in Kent",
    description:
      "Plan a relaxed lunch or a longer evening with the details that make the visit work for your group.",
    question: "What should I check before booking a table?",
    answer:
      "Check the current menu, service times and the policy for your group size. Share dietary or accessibility requirements directly with the venue before confirming. An enquiry is not a reservation until the venue confirms the details.",
    steps: [
      [
        "Choose the occasion",
        "Tell the venue your preferred date, meal and number of guests, including children.",
      ],
      [
        "Discuss what you need",
        "Ask about step-free access, seating, allergens and any time limit on the table.",
      ],
      [
        "Confirm the arrangement",
        "Read any deposit, cancellation and late-arrival terms before completing your booking.",
      ],
    ],
    preparation: [
      "Preferred date and an alternative",
      "Total guest count",
      "Dietary and accessibility questions",
    ],
  },
  {
    slug: "private-dining-and-celebrations",
    title: "Private dining and celebrations",
    description:
      "Bring people together around a menu, a space and a running order that suit the occasion.",
    question: "Is a private room the same as exclusive hire?",
    answer:
      "Not always. A private room may share entrances or facilities with other guests, while exclusive hire can cover a larger part of the venue. Ask exactly what is included, what remains shared and how minimum spend or room hire is calculated.",
    steps: [
      [
        "Describe your gathering",
        "Share the guest count, occasion, preferred atmosphere and any speeches or entertainment.",
      ],
      [
        "Shape the menu and room",
        "Compare seated and informal formats, dietary provision, access and setup needs.",
      ],
      [
        "Agree the written details",
        "Confirm room access times, inclusions, payment dates and cancellation terms before committing.",
      ],
    ],
    preparation: [
      "Approximate guest count and budget",
      "Preferred date and event timings",
      "Any audio, seating or access requirements",
    ],
  },
  {
    slug: "group-visits-and-events",
    title: "Group visits and company events",
    description:
      "A useful starting point for team meals, informal receptions and organised group visits.",
    question: "When should we finalise numbers and dietary needs?",
    answer:
      "Each venue has its own deadline. Agree it at the enquiry stage and nominate one organiser to send the final numbers, menu choices and requirements. Ask how changes after that deadline affect the final bill.",
    steps: [
      [
        "Set the brief",
        "Explain whether you need a meal, a reception or a mix of both, and your preferred timings.",
      ],
      [
        "Check the practicalities",
        "Discuss transport, accessibility, presentation equipment and the way food and drinks will be served.",
      ],
      [
        "Confirm a single plan",
        "Keep the agreed schedule, contact person and final details together so the team knows what to expect.",
      ],
    ],
    preparation: [
      "Event purpose and approximate numbers",
      "Budget and invoice requirements",
      "Schedule and equipment questions",
    ],
  },
];
