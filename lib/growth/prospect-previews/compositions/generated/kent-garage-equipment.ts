import type { ProspectPreviewComposition } from "../types";

export const kentGarageEquipmentComposition = {
  "schemaVersion": "1.1",
  "prospectId": "20a1e2fd-6f28-43b3-a4b6-12dda6017c66",
  "slug": "kent-garage-equipment",
  "family": "automotive",
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
  "copy": {
    "businessName": "Kent Garage Equipment",
    "locality": "Chatham",
    "headline": "Take a workshop from DVSA MOT-bay design through installation, training and aftercare.",
    "primaryCta": "Choose workshop support"
  },
  "content": {
    "businessGoal": "Help workshop operators identify the right equipment or service and submit a well-qualified enquiry.",
    "homepageSections": {
      "schemaVersion": "1.0",
      "summary": "Lead with design, supply and installation, then offer needs-led entry points.",
      "items": [
        "Show the main buyer journeys before the detailed brand and product catalogue."
      ]
    },
    "conversionPlan": {
      "schemaVersion": "1.0",
      "summary": "Collect the minimum project details required for an informed response.",
      "items": [
        "Ask for enquiry type, equipment category, site location and target timing."
      ]
    },
    "trustSignals": {
      "schemaVersion": "1.0",
      "summary": "Preserve product depth and strengthen supporting compliance content.",
      "items": [
        "Replace privacy-policy template placeholders with approved company-specific wording."
      ]
    }
  },
  "journey": {
    "type": "evidence-backed",
    "title": "Plan your workshop project",
    "primaryCta": "Choose workshop support",
    "completionMessage": "Your workshop enquiry is ready for Kent Garage Equipment to review.",
    "steps": [
      {
        "id": "service",
        "label": "What does your workshop need?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "MOT-bay design",
          "Equipment supply and installation",
          "Maintenance",
          "Workshop upgrade"
        ]
      },
      {
        "id": "timing",
        "label": "What is your project timing?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Ready to start",
          "This quarter",
          "Early planning"
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
    "statement": "Take a workshop from DVSA MOT-bay design through installation, training and aftercare.",
    "supportingStatement": "Start with the workshop work you need so Kent Garage Equipment can frame the right equipment conversation.",
    "evidenceIds": [
      "916adb46-bd26-4d3a-88b8-fe859ade08e5"
    ]
  },
  "visual": {
    "brandColors": [
      "#323232"
    ],
    "colourEvidenceIds": [
      "66a6c3ca-e278-4daf-a242-c41e96130529"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "f5c3959e43cdd2ca5add77c819fe1f67a6cf48d2b3341ad3e0d9c9197316712a"
} as const satisfies ProspectPreviewComposition;
