import type { ProspectPreviewComposition } from "../types";

export const wormaldAccountantsComposition = {
  "schemaVersion": "1.0",
  "prospectId": "a0e09bcd-187a-4627-8f09-b0634c27d3d4",
  "slug": "wormald-accountants",
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
    "businessName": "Wormald Accountants",
    "locality": "Maidstone",
    "headline": "Professional advice with a clearer first step in Maidstone.",
    "primaryCta": "Discuss your accounting needs"
  },
  "content": {
    "businessGoal": "Prospective clients could be qualified by service need and business type before a member of the accounts team responds.",
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
        "service and entity selection",
        "deadline and document checklist",
        "a structured team summary"
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
  "digest": "25c38f74ad3888f62609af05959218559fa02c28badeb0641ae9dc038b3f8ab2"
} as const satisfies ProspectPreviewComposition;
