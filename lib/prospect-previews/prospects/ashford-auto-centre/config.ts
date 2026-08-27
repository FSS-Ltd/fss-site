import type { AutomotiveProspectPreview } from "../../types";

export const ashfordAutoCentreConfig = {
  slug: "ashford-auto-centre",
  businessName: "Ashford Auto Centre",
  industry: "automotive",
  location: "Ashford, Kent",
  phone: "01233 555 014",
  brand: {
    primary: "#f97316",
    secondary: "#111827",
    accent: "#facc15",
    background: "#fffaf4",
    foreground: "#15110d",
  },
  research: {
    services: ["MOT testing", "Servicing", "Diagnostics", "Repairs"],
    rating: 4.8,
    reviewCount: 214,
    strengths: ["Established local reputation", "High review rating"],
    opportunities: [
      "A direct MOT booking journey",
      "Vehicle-led service enquiries",
    ],
  },
  sellingAngle: {
    title: "Convert visitors into MOT enquiries",
    description:
      "Give drivers a direct route from their vehicle registration to a clear MOT, service, or repair request.",
    primaryGoal: "mot-enquiries",
  },
  seo: {
    title: "Ashford Auto Centre concept preview",
    description:
      "A private concept preview for Ashford Auto Centre prepared by Faithful Software Solutions.",
  },
  sections: [
    "hero",
    "mot-enquiry",
    "services",
    "reviews",
    "location",
    "contact",
    "owner-cta",
  ],
  ownerCta: {
    title: "Like this concept?",
    description: "We can tailor and launch it around your workshop's workflow.",
    href: "/contact",
    label: "Talk to FSS",
  },
} satisfies Omit<AutomotiveProspectPreview, "content">;
