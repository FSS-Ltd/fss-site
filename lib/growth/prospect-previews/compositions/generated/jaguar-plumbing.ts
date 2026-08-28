import type { ProspectPreviewComposition } from "../types";

export const jaguarPlumbingComposition = {
  "schemaVersion": "1.1",
  "prospectId": "de850ae7-440c-4e45-a14b-b2f03fd66794",
  "slug": "jaguar-plumbing",
  "family": "property",
  "visualDirection": "considered-ledger",
  "heroTreatment": "ledger-grid",
  "sectionOrder": [
    "hero",
    "services",
    "case-for-change",
    "journey",
    "proof",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Jaguar Plumbing",
    "locality": "Dartford",
    "headline": "Get the right plumbing, heating or drainage request to the Jaguar team first time.",
    "primaryCta": "Prepare your service request"
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
        "The contact step could ask visitors to choose plumbing, heating or drainage before they make contact.",
        "It could collect postcode, urgency and a short description so emergency and planned work reach the team with useful context.",
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
    "title": "Prepare your service request",
    "primaryCta": "Prepare your service request",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "service",
        "label": "What do you need help with?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Plumbing",
          "Heating",
          "Drainage",
          "Emergency callout"
        ]
      },
      {
        "id": "urgency",
        "label": "How urgent is the work?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Emergency",
          "This week",
          "Planned work"
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
    "statement": "Get the right plumbing, heating or drainage request to the Jaguar team first time.",
    "supportingStatement": "A clear route can separate urgent work from planned repairs, maintenance and installations.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000007"
    ]
  },
  "visual": {
    "brandColors": [
      "#2D3940"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000008"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "ffcbdc4f18c65d55a7f80c8ffa465e12e64ec6c7f70ddb719bddbde45194b96c"
} as const satisfies ProspectPreviewComposition;
