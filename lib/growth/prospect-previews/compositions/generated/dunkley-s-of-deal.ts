import type { ProspectPreviewComposition } from "../types";

export const dunkleySOfDealComposition = {
  "schemaVersion": "1.0",
  "prospectId": "cfc1ee0a-3f0b-49f8-9be3-e371311958a5",
  "slug": "dunkley-s-of-deal",
  "family": "automotive",
  "visualDirection": "precision-dark",
  "heroTreatment": "workshop-geometry",
  "sectionOrder": [
    "hero",
    "proof",
    "services",
    "journey",
    "locality",
    "owner-cta"
  ],
  "journey": {
    "type": "mot-request",
    "completionMessage": "Your preferred time is ready for a follow-up."
  },
  "copy": {
    "businessName": "Dunkley's of Deal",
    "locality": "Deal",
    "headline": "Vehicle care made easier to book in Deal.",
    "primaryCta": "Request a workshop slot"
  },
  "content": {
    "businessGoal": "Vehicle and service details could be captured online before MOT, repair or commercial-vehicle availability is confirmed.",
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
        "vehicle class and registration",
        "service need and preferred date",
        "an organised workshop hand-off"
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
  "digest": "3cca1f342cb8ed950f58b75c541977ba1667630313fa2bc391ac80881f19eb30"
} as const satisfies ProspectPreviewComposition;
