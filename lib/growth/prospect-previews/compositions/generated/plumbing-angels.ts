import type { ProspectPreviewComposition } from "../types";

export const plumbingAngelsComposition = {
  "schemaVersion": "1.1",
  "prospectId": "24af7e0c-02e6-493a-88fd-e18d5fa73a58",
  "slug": "plumbing-angels",
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
    "businessName": "Plumbing Angels",
    "locality": "Tunbridge Wells",
    "headline": "Give Plumbing Angels the service, urgency and timing needed for a useful first response.",
    "primaryCta": "Prepare your heating request"
  },
  "content": {
    "businessGoal": "Turn qualified local service customers into enquiries that arrive with enough context for a useful response.",
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
        "The enquiry journey could route planned boiler work separately from urgent breakdowns.",
        "It could collect service type, postcode, urgency and preferred contact time before the team responds.",
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
    "title": "Prepare your heating request",
    "primaryCta": "Prepare your heating request",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "service",
        "label": "What does your heating system need?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Boiler installation",
          "Boiler service",
          "Breakdown",
          "Repair"
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
          "Urgent",
          "This week",
          "I am planning ahead"
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
    "statement": "Give Plumbing Angels the service, urgency and timing needed for a useful first response.",
    "supportingStatement": "A clearer route can keep planned boiler work distinct from an urgent breakdown or repair.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000015"
    ]
  },
  "visual": {
    "brandColors": [
      "#0A1E33"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000016"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "713ee108a40a8700ce4256279e06ae4cb36c67c2d9f0bed820473077e96cb526"
} as const satisfies ProspectPreviewComposition;
