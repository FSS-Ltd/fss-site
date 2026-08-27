import type { ProspectPreviewComposition } from "../types";

export const brightFoxLettingsComposition = {
  "schemaVersion": "1.0",
  "prospectId": "b7cd8cdd-0862-4078-8583-603756f27eac",
  "slug": "bright-fox-lettings",
  "family": "property",
  "visualDirection": "considered-ledger",
  "heroTreatment": "ledger-grid",
  "sectionOrder": [
    "hero",
    "services",
    "case-for-change",
    "journey",
    "proof",
    "owner-cta"
  ],
  "journey": {
    "type": "valuation-request",
    "completionMessage": "Your property enquiry is ready for a local follow-up."
  },
  "copy": {
    "businessName": "Bright Fox Lettings",
    "locality": "Royal Tunbridge Wells",
    "headline": "A clearer start for property decisions in Royal Tunbridge Wells.",
    "primaryCta": "Choose your property enquiry"
  },
  "content": {
    "businessGoal": "Landlord and tenant requests could enter separate structured paths and reach property management with clearer context.",
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
        "landlord or tenant routing",
        "property and request details",
        "managed-property hand-off"
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
  "digest": "a87674c87ab78852aaa1db67f21741efb30a0be48a7c21efc2a2144f2ac465bb"
} as const satisfies ProspectPreviewComposition;
