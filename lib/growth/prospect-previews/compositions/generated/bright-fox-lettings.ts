import type { ProspectPreviewComposition } from "../types";

export const brightFoxLettingsComposition = {
  "schemaVersion": "1.1",
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
  "copy": {
    "businessName": "Bright Fox Lettings",
    "locality": "Royal Tunbridge Wells",
    "headline": "Let your property with a service level that fits the way you want to manage it.",
    "primaryCta": "Choose landlord service"
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
  "journey": {
    "type": "evidence-backed",
    "title": "Find the right landlord service",
    "primaryCta": "Choose landlord service",
    "completionMessage": "Your landlord enquiry is ready for Bright Fox to review.",
    "steps": [
      {
        "id": "service",
        "label": "Which landlord service do you need?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Let Only",
          "Rent Collection",
          "Full Management"
        ]
      },
      {
        "id": "need",
        "label": "What would you like help with first?",
        "kind": "needs-selection",
        "control": "multi-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Market valuation",
          "Tenant finding",
          "Property management"
        ]
      },
      {
        "id": "review",
        "label": "Review your request",
        "kind": "review",
        "control": "review",
        "requiredFields": [],
        "options": []
      }
    ]
  },
  "hero": {
    "statement": "Let your property with a service level that fits the way you want to manage it.",
    "supportingStatement": "Choose Let Only, Rent Collection or Full Management before sharing your property details.",
    "evidenceIds": [
      "6e9d60a6-339e-41ac-8a3f-9b9859e42e14"
    ]
  },
  "visual": {
    "brandColors": [
      "#50485B"
    ],
    "colourEvidenceIds": [
      "a33d6651-0391-4327-ae95-36d629f88043"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "62fde500705dc4836a708b64cc34fda0e2690cc1017ef55b8a10fda622d1e269"
} as const satisfies ProspectPreviewComposition;
