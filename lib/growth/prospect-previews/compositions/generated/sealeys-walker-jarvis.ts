import type { ProspectPreviewComposition } from "../types";

export const sealeysWalkerJarvisComposition = {
  "schemaVersion": "1.0",
  "prospectId": "4254ecd1-d8b3-4acb-81c9-b3973cf4f213",
  "slug": "sealeys-walker-jarvis",
  "family": "property",
  "visualDirection": "local-service",
  "heroTreatment": "property-frame",
  "sectionOrder": [
    "hero",
    "proof",
    "locality",
    "services",
    "journey",
    "owner-cta"
  ],
  "journey": {
    "type": "valuation-request",
    "completionMessage": "Your property enquiry is ready for a local follow-up."
  },
  "copy": {
    "businessName": "Sealeys Walker Jarvis",
    "locality": "Gravesend",
    "headline": "A clearer start for property decisions in Gravesend.",
    "primaryCta": "Start a property enquiry"
  },
  "content": {
    "businessGoal": "Sales, lettings and commercial enquiries could be routed with property and timing context instead of relying on department selection alone.",
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
        "location, timing and ownership context",
        "department routing and confirmation"
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
  "digest": "a538f99487ba6d41eb811df7d05c8547fe429e18d60e53d234e246c95fa9b86b"
} as const satisfies ProspectPreviewComposition;
