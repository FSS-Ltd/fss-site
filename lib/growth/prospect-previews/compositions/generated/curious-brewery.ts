import type { ProspectPreviewComposition } from "../types";

export const curiousBreweryComposition = {
  "schemaVersion": "1.1",
  "prospectId": "255961bf-265a-4e3c-9abb-5083677777d1",
  "slug": "curious-brewery",
  "family": "hospitality",
  "visualDirection": "calm-architectural",
  "heroTreatment": "property-frame",
  "sectionOrder": [
    "hero",
    "locality",
    "services",
    "proof",
    "journey",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Curious Brewery",
    "locality": "Ashford",
    "headline": "Plan a Curious Taprooms visit around the occasion, the table and the people joining you.",
    "primaryCta": "Plan your Taprooms visit"
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
        "The contact journey could separate table bookings, group occasions and general questions before collecting details.",
        "Booking enquiries could ask for preferred date, time, party size and any accessibility or dietary context.",
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
    "title": "Plan your Taprooms visit",
    "primaryCta": "Plan your Taprooms visit",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "visit-type",
        "label": "What are you planning?",
        "kind": "needs-selection",
        "control": "single-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Table booking",
          "Group occasion",
          "General question"
        ]
      },
      {
        "id": "party-size",
        "label": "How many people are joining?",
        "kind": "needs-selection",
        "control": "single-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Up to 8",
          "9 to 20",
          "More than 20"
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
    "statement": "Plan a Curious Taprooms visit around the occasion, the table and the people joining you.",
    "supportingStatement": "Food, fresh beer and group bookings can start with the details that make an Ashford visit work.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000003"
    ]
  },
  "visual": {
    "brandColors": [
      "#011835"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000004"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "018d4ed3c00456428569d404c36133881b32a89ff1a99e27deb5a470aedbb6fe"
} as const satisfies ProspectPreviewComposition;
