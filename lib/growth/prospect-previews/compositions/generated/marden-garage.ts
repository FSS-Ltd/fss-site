import type { ProspectPreviewComposition } from "../types";

export const mardenGarageComposition = {
  "schemaVersion": "1.0",
  "prospectId": "b759f698-0852-4ed0-acc7-62d55ab0adb0",
  "slug": "marden-garage",
  "family": "automotive",
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
    "type": "mot-request",
    "completionMessage": "Your preferred time is ready for a follow-up."
  },
  "copy": {
    "businessName": "Marden Garage",
    "locality": "Marden",
    "headline": "Vehicle care made easier to book in Marden.",
    "primaryCta": "Request a service appointment"
  },
  "content": {
    "businessGoal": "A single vehicle-service request could prepare MOT, repair and recovery enquiries before workshop follow-up.",
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
        "vehicle and service details",
        "warning signs and preferred timing",
        "a clear workshop summary"
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
  "digest": "1392db44b9f944b9e2e469d3974042b5d2622e23bf087dfbaf49539358e569c0"
} as const satisfies ProspectPreviewComposition;
