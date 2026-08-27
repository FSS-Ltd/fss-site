import type { ProspectPreviewComposition } from "../types";

export const primelineRoofingComposition = {
  "schemaVersion": "1.0",
  "prospectId": "fe6b26a6-de57-4041-a322-2824b27098d2",
  "slug": "primeline-roofing",
  "family": "property",
  "visualDirection": "calm-architectural",
  "heroTreatment": "property-frame",
  "sectionOrder": [
    "hero",
    "locality",
    "proof",
    "journey",
    "services",
    "owner-cta"
  ],
  "journey": {
    "type": "valuation-request",
    "completionMessage": "Your property enquiry is ready for a local follow-up."
  },
  "copy": {
    "businessName": "Primeline Roofing",
    "locality": "Chatham",
    "headline": "A clearer start for property decisions in Chatham.",
    "primaryCta": "Arrange a free site visit"
  },
  "content": {
    "businessGoal": "Quote requests could include property type, urgency and supporting photos before a free site visit is arranged.",
    "homepageSections": {
      "schemaVersion": "1.0",
      "summary": "Explain the service path before requesting contact details.",
      "items": [
        "Service promise",
        "Service choices",
        "Process",
        "Trust",
        "Enquiry"
      ]
    },
    "conversionPlan": {
      "schemaVersion": "1.0",
      "summary": "Collect the minimum information needed for a useful first response.",
      "items": [
        "roofing need and property type",
        "urgency, access and photo details",
        "visit scheduling and confirmation"
      ]
    },
    "trustSignals": {
      "schemaVersion": "1.0",
      "summary": "Present only claims and credentials the business can verify.",
      "items": [
        "Company identity",
        "Relevant credentials",
        "Service process",
        "Contact details"
      ]
    }
  },
  "digest": "6fac75d93f771955539de40ff8c7b47fb6cfcbaeba5243bbbdf58950ba80bcab"
} as const satisfies ProspectPreviewComposition;
