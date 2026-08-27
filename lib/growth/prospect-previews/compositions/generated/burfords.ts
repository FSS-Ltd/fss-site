import type { ProspectPreviewComposition } from "../types";

export const burfordsComposition = {
  "schemaVersion": "1.0",
  "prospectId": "1a0c80dc-e163-44ee-b975-3bea9aec2c85",
  "slug": "burfords",
  "family": "professional-services",
  "visualDirection": "warm-editorial",
  "heroTreatment": "service-map",
  "sectionOrder": [
    "hero",
    "proof",
    "services",
    "locality",
    "journey",
    "owner-cta"
  ],
  "journey": {
    "type": "consultation-request",
    "completionMessage": "Your consultation request is ready for a clear next step."
  },
  "copy": {
    "businessName": "Burfords",
    "locality": "Welling",
    "headline": "Professional advice with a clearer first step in Welling.",
    "primaryCta": "Discuss your accountancy needs"
  },
  "content": {
    "businessGoal": "Help prospective clients match their need to Burfords expertise and make a well-scoped enquiry.",
    "homepageSections": {
      "schemaVersion": "1.0",
      "summary": "Connect the partner-led proposition, client needs, relevant services and team expertise in sequence.",
      "items": [
        "Replace placeholder testimonial cards with approved evidence or remove them until content is ready."
      ]
    },
    "conversionPlan": {
      "schemaVersion": "1.0",
      "summary": "Qualify enquiries with a short, accessible form.",
      "items": [
        "Add service need, business stage and preferred response timeframe to the contact journey."
      ]
    },
    "trustSignals": {
      "schemaVersion": "1.0",
      "summary": "Use the detailed team biographies as the primary trust layer.",
      "items": [
        "Link each service journey to the relevant named expertise and professional qualifications."
      ]
    }
  },
  "digest": "7a350ddb839d6715abf73de7c5d69faba1fb7022fbc25912517229736764a534"
} as const satisfies ProspectPreviewComposition;
