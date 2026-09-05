import { plumbingJourney } from "./journeys/plumbing";
import { electricalJourney } from "./journeys/electrical";
import { hospitalityJourney } from "./journeys/hospitality";
import { landscapeJourney } from "./journeys/landscape";
import { suppliesJourney } from "./journeys/supplies";
import { equipmentJourney } from "./journeys/equipment";
import type { ExampleTheme } from "./catalog";

export const exampleJourneys: Record<
  ExampleTheme,
  {
    title: string;
    intro: string;
    question: string;
    options: readonly string[];
    detailLabel: string;
    details: readonly string[];
    next: string;
  }
> = {
  plumbing: plumbingJourney,
  electrical: electricalJourney,
  hospitality: hospitalityJourney,
  landscape: landscapeJourney,
  supplies: suppliesJourney,
  equipment: equipmentJourney,

  roof: {
    title: "Let’s get a clearer picture.",
    intro: "A few details now make the first conversation more useful.",
    question: "What brings you here?",
    options: [
      "A leak or visible damage",
      "A roof that needs replacing",
      "An extension or new build",
      "I’m not sure yet",
    ],
    detailLabel: "How soon do you need help?",
    details: ["As soon as possible", "Within the next month", "Planning ahead"],
    next: "A surveyor would discuss access, the affected area and a suitable inspection time before recommending any work.",
  },
  estate: {
    title: "Your next chapter starts here.",
    intro:
      "Tell us where you are in your move. We’ll show you the right next step.",
    question: "What are you planning?",
    options: ["Sell my home", "Buy a home", "Let my property", "Find a rental"],
    detailLabel: "When would you like to move?",
    details: [
      "As soon as the right opportunity comes",
      "In the next three months",
      "I’m exploring my options",
    ],
    next: "An agent would discuss your area, priorities and timing, then arrange a valuation or a viewing that fits.",
  },
  auto: {
    title: "Let’s get you moving.",
    intro:
      "Choose the work you need. Get a clear next step before handing over the keys.",
    question: "What does your car need?",
    options: [
      "MOT & servicing",
      "A warning light or diagnosis",
      "Brakes, tyres or repairs",
      "Help identifying a problem",
    ],
    detailLabel: "How is the car running?",
    details: [
      "Driving normally",
      "A change in how it drives",
      "Not currently driveable",
    ],
    next: "The workshop would confirm your vehicle details and availability, then explain the diagnostic or service cost before booking.",
  },
  accounts: {
    title: "A better conversation about business.",
    intro:
      "Find the support that fits where you are, and where you want to go.",
    question: "What would help most?",
    options: [
      "Starting a business",
      "Keeping the books in order",
      "Understanding cash flow",
      "Switching accountants",
    ],
    detailLabel: "How is your business set up?",
    details: ["Sole trader", "Limited company", "Still deciding"],
    next: "An accountant would review your current setup, deadlines and goals, then outline the support and fee before you decide.",
  },
};
