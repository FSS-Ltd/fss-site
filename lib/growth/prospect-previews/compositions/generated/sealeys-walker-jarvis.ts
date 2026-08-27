import type { ProspectPreviewComposition } from "../types";

export const sealeysWalkerJarvisComposition = {
  "schemaVersion": "1.1",
  "prospectId": "4254ecd1-d8b3-4acb-81c9-b3973cf4f213",
  "slug": "sealeys-walker-jarvis",
  "family": "property",
  "visualDirection": "calm-architectural",
  "heroTreatment": "property-frame",
  "sectionOrder": [
    "hero",
    "locality",
    "proof",
    "journey",
    "services",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Sealeys Walker Jarvis",
    "locality": "Gravesend",
    "headline": "A Gravesend property enquiry that begins with sales, lettings, commercial or auction context.",
    "primaryCta": "Choose property route"
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
  "journey": {
    "type": "evidence-backed",
    "title": "Start the right property conversation",
    "primaryCta": "Choose property route",
    "completionMessage": "Your Sealeys Walker Jarvis enquiry is ready to review.",
    "steps": [
      {
        "id": "service",
        "label": "What can Sealeys help with?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Residential sales",
          "Lettings and management",
          "Commercial property",
          "Auctions"
        ]
      },
      {
        "id": "timing",
        "label": "What is your timing?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Ready to move",
          "This season",
          "Planning ahead"
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
    "statement": "A Gravesend property enquiry that begins with sales, lettings, commercial or auction context.",
    "supportingStatement": "Give Sealeys Walker Jarvis the property route you need before the right team responds.",
    "evidenceIds": [
      "5e5b1b67-6a01-47b5-bc95-59740efa2b6c"
    ]
  },
  "visual": {
    "brandColors": [
      "#FFED00",
      "#1D1D1B"
    ],
    "colourEvidenceIds": [
      "876f1b58-e429-4624-b8c8-d6c979d7ca3f"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "cb8f2349a33a858ebb54613b16d9c2ac0d3a5149abbdfa5564cc53f833b5b790"
} as const satisfies ProspectPreviewComposition;
