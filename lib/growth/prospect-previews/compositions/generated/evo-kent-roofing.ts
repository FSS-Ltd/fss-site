import type { ProspectPreviewComposition } from "../types";

export const evoKentRoofingComposition = {
  "schemaVersion": "1.1",
  "prospectId": "453e6ac6-e72b-4167-82a8-0c72de4ad5e7",
  "slug": "evo-kent-roofing",
  "family": "property",
  "visualDirection": "considered-ledger",
  "heroTreatment": "service-map",
  "sectionOrder": [
    "hero",
    "services",
    "proof",
    "case-for-change",
    "journey",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Evo Kent Roofing",
    "locality": "Gravesend",
    "headline": "Roofing repairs and replacements for homes, businesses and public buildings across Kent.",
    "primaryCta": "Choose roofing work"
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
  "journey": {
    "type": "evidence-backed",
    "title": "Plan your roofing assessment",
    "primaryCta": "Choose roofing work",
    "completionMessage": "Your roofing request is ready for Evo Kent to review.",
    "steps": [
      {
        "id": "service",
        "label": "What roofing work do you need?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Roof repair",
          "Flat roof",
          "Pitched roof",
          "Roof replacement"
        ]
      },
      {
        "id": "timing",
        "label": "How soon do you need help?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Urgent repair",
          "This month",
          "Planning a project"
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
    "statement": "Roofing repairs and replacements for homes, businesses and public buildings across Kent.",
    "supportingStatement": "Begin with the roof work you need so Evo Kent can prepare a focused assessment.",
    "evidenceIds": [
      "572ff3cc-6ea0-4b76-abc5-d0d447751cf0"
    ]
  },
  "visual": {
    "brandColors": [
      "#2B5672"
    ],
    "colourEvidenceIds": [
      "fb6543a7-83db-49e7-b65e-2777a73a4a6b"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "402732a3992a918333f093d996a9a6fba0e7aa6b4336f5a8bf13a743796d4d78"
} as const satisfies ProspectPreviewComposition;
