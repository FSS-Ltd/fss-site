import type { ProspectPreviewComposition } from "../types";

export const paperstoneComposition = {
  "schemaVersion": "1.1",
  "prospectId": "e940da78-2142-4169-92b7-8a1a5e7bc930",
  "slug": "paperstone",
  "family": "professional-services",
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
  "copy": {
    "businessName": "Paperstone",
    "locality": "Tunbridge Wells",
    "headline": "More than 60,000 office and business supplies ready for next-working-day delivery.",
    "primaryCta": "Choose supply need"
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
  "journey": {
    "type": "evidence-backed",
    "title": "Find the right business-supply route",
    "primaryCta": "Choose supply need",
    "completionMessage": "Your Paperstone supply request is ready to review.",
    "steps": [
      {
        "id": "service",
        "label": "What are you sourcing?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Everyday office supplies",
          "Workplace and warehouse",
          "Catering and cleaning",
          "Business credit account"
        ]
      },
      {
        "id": "timing",
        "label": "When do you need delivery?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Next working day",
          "This week",
          "Planning a repeat order"
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
    "statement": "More than 60,000 office and business supplies ready for next-working-day delivery.",
    "supportingStatement": "Start with the supplies or business route you need, then give Paperstone a clearer brief.",
    "evidenceIds": [
      "d2a426ff-eb8f-4b57-80ec-37f766ceb551"
    ]
  },
  "visual": {
    "brandColors": [
      "#17213A",
      "#EB4297"
    ],
    "colourEvidenceIds": [
      "b77edcde-c72a-4b75-8737-f0a3b933c1cc"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "505bf99bcd28798b508248d2f607bdc6bcb9594b5452e786bdf411fe87b51fce"
} as const satisfies ProspectPreviewComposition;
