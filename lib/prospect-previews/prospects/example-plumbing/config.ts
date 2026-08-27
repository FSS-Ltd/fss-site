import type { TradeProspectPreview } from "../../types";

export const examplePlumbingConfig = {
  slug: "example-plumbing",
  businessName: "Harbourline Plumbing",
  industry: "trades",
  location: "Deal, Kent",
  phone: "01304 555 026",
  brand: {
    primary: "#075985",
    secondary: "#082f49",
    accent: "#bef264",
    background: "#ecfeff",
    foreground: "#082f49",
  },
  research: {
    services: ["Emergency plumbing", "Boiler repairs", "Leaks", "Drainage"],
    rating: 4.9,
    reviewCount: 167,
    strengths: ["Fast local response", "Clear customer feedback"],
    opportunities: ["Urgency-aware quote requests", "Postcode qualification"],
  },
  sellingAngle: {
    title: "Convert visitors into qualified quote requests",
    description:
      "Capture the problem, location, and urgency before the first call so the right response starts faster.",
    primaryGoal: "qualified-quote-requests",
  },
  seo: {
    title: "Harbourline Plumbing concept preview",
    description:
      "A private concept preview for Harbourline Plumbing prepared by Faithful Software Solutions.",
  },
  sections: [
    "hero",
    "service-selector",
    "service-area",
    "reviews",
    "contact",
    "owner-cta",
  ],
  ownerCta: {
    title: "Like this concept?",
    description:
      "We can shape the live journey around your team and service area.",
    href: "/contact",
    label: "Talk to FSS",
  },
} satisfies Omit<TradeProspectPreview, "content">;
