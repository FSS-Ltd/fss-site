import type { ProspectPreviewComposition } from "../types";

export const hideAndFoxComposition = {
  "schemaVersion": "1.1",
  "prospectId": "386bca90-e1a7-4490-91ec-e6d585e9fcc9",
  "slug": "hide-and-fox",
  "family": "hospitality",
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
  "copy": {
    "businessName": "Hide and Fox",
    "locality": "Saltwood",
    "headline": "A Saltwood tasting-menu experience built around seasonal ingredients and thoughtful wine pairings.",
    "primaryCta": "Choose dining experience"
  },
  "content": {
    "businessGoal": "Event and exclusive-hire enquiries could collect group, dietary and timing details without changing the existing reservation system.",
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
        "occasion, group size and date",
        "dietary and experience requirements",
        "a concise event summary"
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
    "title": "Plan your dining experience",
    "primaryCta": "Choose dining experience",
    "completionMessage": "Your Hide and Fox enquiry is ready to review.",
    "steps": [
      {
        "id": "service",
        "label": "What would you like to plan?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Five-course tasting menu",
          "Eight-course tasting menu",
          "Vegetarian menu",
          "Exclusive hire"
        ]
      },
      {
        "id": "need",
        "label": "What should the restaurant know?",
        "kind": "needs-selection",
        "control": "multi-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Wine pairing",
          "Dietary requirements",
          "Group of more than six"
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
    "statement": "A Saltwood tasting-menu experience built around seasonal ingredients and thoughtful wine pairings.",
    "supportingStatement": "Choose a menu route, then let Hide and Fox know whether your request is for a table or exclusive hire.",
    "evidenceIds": [
      "3ea219fb-d823-46fb-9bed-31da53940055"
    ]
  },
  "visual": {
    "brandColors": [
      "#CAA93F",
      "#223852"
    ],
    "colourEvidenceIds": [
      "2ba96b11-dc1b-462d-9b9c-d19ea2ba2b84"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "c4aca73390a837ac2d85d6e04a4fdc2230a7d55844b09f4f2c95d30056003e17"
} as const satisfies ProspectPreviewComposition;
