import type { ProspectPreviewComposition } from "../types";

export const hideAndFoxComposition = {
  "schemaVersion": "1.0",
  "prospectId": "386bca90-e1a7-4490-91ec-e6d585e9fcc9",
  "slug": "hide-and-fox",
  "family": "hospitality",
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
    "type": "table-enquiry",
    "completionMessage": "Your table enquiry is ready for a considered reply."
  },
  "copy": {
    "businessName": "Hide and Fox",
    "locality": "Saltwood",
    "headline": "A more considered first welcome in Saltwood.",
    "primaryCta": "Discuss a private event"
  },
  "content": {
    "businessGoal": "Event and exclusive-hire enquiries could collect group, dietary and timing details without changing the existing reservation system.",
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
        "occasion, group size and date",
        "dietary and experience requirements",
        "a concise event summary"
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
  "digest": "21faab1eb68e0d2354ef79b75d86d6684e1047524153105cf2d56595c1e12110"
} as const satisfies ProspectPreviewComposition;
