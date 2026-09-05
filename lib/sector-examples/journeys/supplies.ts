export const suppliesJourney = {
  title: "Let’s make your supply list work.",
  intro:
    "Build a useful starting point for a quote conversation. This example does not place an order.",
  question: "What are you organising?",
  options: [
    "A new office setup",
    "A regular restock",
    "A product or price comparison",
    "Help building a supply list",
  ],
  detailLabel: "How often do you expect to order?",
  details: [
    "A one-off order",
    "Regular replenishment",
    "Still working that out",
  ],
  next: "A supplier would review the products, quantities and delivery requirements, then clarify availability, substitutions and the complete quote before you decide.",
} as const;
