import type { ProspectPreviewComposition } from "../types";

export const fugglesBeerCafeComposition = {
  "schemaVersion": "1.1",
  "prospectId": "67323610-eca8-4fd5-8ef2-4da5bf11f45d",
  "slug": "fuggles-beer-cafe",
  "family": "hospitality",
  "visualDirection": "calm-architectural",
  "heroTreatment": "local-silhouette",
  "sectionOrder": [
    "hero",
    "proof",
    "locality",
    "journey",
    "case-for-change",
    "services",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Fuggles Beer Cafe",
    "locality": "Tunbridge Wells",
    "headline": "Thirty beers on tap, more than 100 in the fridges, with food served all day.",
    "primaryCta": "Choose booking type"
  },
  "content": {
    "businessGoal": "Special-event and venue-specific requests could use one structured path while normal table reservations remain unchanged.",
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
        "venue and occasion selection",
        "group size, date and requirements",
        "a booking-team summary"
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
    "title": "Plan your Fuggles booking",
    "primaryCta": "Choose booking type",
    "completionMessage": "Your Fuggles booking request is ready to review.",
    "steps": [
      {
        "id": "service",
        "label": "What are you planning?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Group booking",
          "Birthday or celebration",
          "Special event",
          "Venue availability"
        ]
      },
      {
        "id": "timing",
        "label": "When would you like to visit?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "This week",
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
    "statement": "Thirty beers on tap, more than 100 in the fridges, with food served all day.",
    "supportingStatement": "Give Fuggles the shape of your group booking, celebration or event before the conversation starts.",
    "evidenceIds": [
      "5b5e65b2-8bc7-4c43-adeb-1e7c6cb7a382"
    ]
  },
  "visual": {
    "brandColors": [
      "#F0523D"
    ],
    "colourEvidenceIds": [
      "1ab94832-6465-43a7-97b7-b64f344982e1"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "827c480950a56b0f907d27844a25fc253f982ff14715c57537825ddcee78246c"
} as const satisfies ProspectPreviewComposition;
