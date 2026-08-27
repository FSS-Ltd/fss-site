import type { ProspectPreviewComposition } from "../types";

export const paperstoneComposition = {
  "schemaVersion": "1.0",
  "prospectId": "e940da78-2142-4169-92b7-8a1a5e7bc930",
  "slug": "paperstone",
  "family": "professional-services",
  "visualDirection": "considered-ledger",
  "heroTreatment": "ledger-grid",
  "sectionOrder": [
    "hero",
    "proof",
    "case-for-change",
    "journey",
    "services",
    "owner-cta"
  ],
  "journey": {
    "type": "consultation-request",
    "completionMessage": "Your consultation request is ready for a clear next step."
  },
  "copy": {
    "businessName": "Paperstone",
    "locality": "Tunbridge Wells",
    "headline": "Professional advice with a clearer first step in Tunbridge Wells.",
    "primaryCta": "Request a supply comparison"
  },
  "content": {
    "businessGoal": "The comparison-quote route could securely collect supplier invoices and structured purchasing requirements before account-manager review.",
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
        "company and supply requirements",
        "secure invoice upload",
        "account-manager routing and confirmation"
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
  "digest": "57d50851be1c7340d207b11c0fa96b998d8882a97f59a47020ca33ab93a9219b"
} as const satisfies ProspectPreviewComposition;
