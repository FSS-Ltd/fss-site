import type { ProspectPreviewComposition } from "../types";

export const kBarComposition = {
  "schemaVersion": "1.1",
  "prospectId": "4b7f2589-3309-442a-b6fc-140c4d546478",
  "slug": "k-bar",
  "family": "hospitality",
  "visualDirection": "warm-editorial",
  "heroTreatment": "crafted-table",
  "sectionOrder": [
    "hero",
    "proof",
    "services",
    "journey",
    "locality",
    "owner-cta"
  ],
  "copy": {
    "businessName": "K Bar",
    "locality": "Staplehurst",
    "headline": "Plan the bar around your event before the quotation conversation starts.",
    "primaryCta": "Plan your event bar"
  },
  "content": {
    "businessGoal": "Turn qualified guests and organisers into enquiries that arrive with enough context for a useful response.",
    "homepageSections": {
      "schemaVersion": "1.0",
      "summary": "Show the offer and the next step in a clear sequence.",
      "items": [
        "Value proposition",
        "Service choices",
        "How it works",
        "Verified trust",
        "Enquiry action"
      ]
    },
    "conversionPlan": {
      "schemaVersion": "1.0",
      "summary": "Collect only the details needed to route and assess the request.",
      "items": [
        "The journey could help visitors compare inclusive hire, dry hire and drinks packages before opening the form.",
        "The form could add structured choices for bar format, budget range and venue-licensing needs.",
        "Provide a useful confirmation after submission"
      ]
    },
    "trustSignals": {
      "schemaVersion": "1.0",
      "summary": "Present only first-party claims and credentials the company can verify.",
      "items": [
        "Registered company identity",
        "Named team or process",
        "Published service details",
        "Current contact routes"
      ]
    }
  },
  "journey": {
    "type": "evidence-backed",
    "title": "Plan your event bar",
    "primaryCta": "Plan your event bar",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "bar-format",
        "label": "Which bar format suits your event?",
        "kind": "needs-selection",
        "control": "single-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Inclusive bar hire",
          "Dry hire",
          "Drinks package"
        ]
      },
      {
        "id": "guest-count",
        "label": "How many guests are you expecting?",
        "kind": "needs-selection",
        "control": "single-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Up to 50",
          "51 to 150",
          "More than 150"
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
    "statement": "Plan the bar around your event before the quotation conversation starts.",
    "supportingStatement": "K Bar can shape inclusive hire, dry hire and drinks packages around a venue and guest list.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000009"
    ]
  },
  "visual": {
    "brandColors": [
      "#0D4F3D"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000010"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "ea4413a663788f56312ebc9e3fbc43a57888ad7c33e8b82a6388f05fcf719163"
} as const satisfies ProspectPreviewComposition;
