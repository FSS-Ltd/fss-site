import type { ProspectPreviewComposition } from "../types";

export const evoKentRoofingComposition = {
  "schemaVersion": "1.0",
  "prospectId": "453e6ac6-e72b-4167-82a8-0c72de4ad5e7",
  "slug": "evo-kent-roofing",
  "family": "property",
  "visualDirection": "calm-architectural",
  "heroTreatment": "crafted-table",
  "sectionOrder": [
    "hero",
    "services",
    "case-for-change",
    "proof",
    "journey",
    "owner-cta"
  ],
  "journey": {
    "type": "valuation-request",
    "completionMessage": "Your property enquiry is ready for a local follow-up."
  },
  "copy": {
    "businessName": "Evo Kent Roofing",
    "locality": "Gravesend",
    "headline": "A clearer start for property decisions in Gravesend.",
    "primaryCta": "Request a roofing assessment"
  },
  "content": {
    "businessGoal": "A structured quote journey could collect property, roof, urgency and photo details before a site-visit call-back.",
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
        "service and property selection",
        "postcode, urgency and photo upload",
        "a site-visit-ready summary"
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
  "digest": "906e761dc75e13b7def5fd7c6d927454c9e24c9bcf9270183ae55d3302da2c17"
} as const satisfies ProspectPreviewComposition;
