import type { ProspectPreviewComposition } from "../types";

export const primelineRoofingComposition = {
  "schemaVersion": "1.1",
  "prospectId": "fe6b26a6-de57-4041-a322-2824b27098d2",
  "slug": "primeline-roofing",
  "family": "property",
  "visualDirection": "precision-dark",
  "heroTreatment": "property-frame",
  "sectionOrder": [
    "hero",
    "locality",
    "services",
    "case-for-change",
    "journey",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Primeline Roofing",
    "locality": "Chatham",
    "headline": "Start a roofing enquiry with the work, property and urgency already clear.",
    "primaryCta": "Choose roofing work"
  },
  "content": {
    "businessGoal": "Quote requests could include property type, urgency and supporting photos before a free site visit is arranged.",
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
        "roofing need and property type",
        "urgency, access and photo details",
        "visit scheduling and confirmation"
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
    "title": "Arrange your roofing visit",
    "primaryCta": "Choose roofing work",
    "completionMessage": "Your Primeline Roofing enquiry is ready to review.",
    "steps": [
      {
        "id": "service",
        "label": "What work do you need?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Roof repair",
          "Roof replacement",
          "New roof",
          "Free site visit"
        ]
      },
      {
        "id": "timing",
        "label": "How urgent is the work?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Urgent",
          "This month",
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
    "statement": "Start a roofing enquiry with the work, property and urgency already clear.",
    "supportingStatement": "Primeline Roofing can prepare a focused response for repair, replacement or a new-roof project.",
    "evidenceIds": [
      "6ca17919-5740-4929-a50e-6cf935522db6"
    ]
  },
  "visual": {
    "brandColors": [
      "#2575FC"
    ],
    "colourEvidenceIds": [
      "8ba154fc-0af9-4b78-a82c-72bf758328b2"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "d5dcb5fbfaba66fdd7d0b8557e554cc1c0ae0899450efdd6705584a831061b67"
} as const satisfies ProspectPreviewComposition;
