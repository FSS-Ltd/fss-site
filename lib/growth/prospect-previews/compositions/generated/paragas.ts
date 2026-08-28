import type { ProspectPreviewComposition } from "../types";

export const paragasComposition = {
  "schemaVersion": "1.1",
  "prospectId": "e9d5efae-767a-43b7-89b7-3f975cfb850c",
  "slug": "paragas",
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
    "businessName": "PARAGAS",
    "locality": "Dymchurch",
    "headline": "Separate an emergency callout from a planned gas, heating or plumbing request from the start.",
    "primaryCta": "Prepare your PARAGAS request"
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
        "The booking journey could distinguish emergency call-outs from planned appointments before collecting details.",
        "The general help field could be supported by structured choices for service type, postcode and urgency.",
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
    "title": "Prepare your PARAGAS request",
    "primaryCta": "Prepare your PARAGAS request",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "request-type",
        "label": "What do you need help with?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Emergency callout",
          "Boiler service or repair",
          "Gas or LPG work",
          "Plumbing"
        ]
      },
      {
        "id": "timing",
        "label": "When do you need help?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Now",
          "This week",
          "I need a quote"
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
    "statement": "Separate an emergency callout from a planned gas, heating or plumbing request from the start.",
    "supportingStatement": "PARAGAS can prepare the right conversation for urgent cover, a quote, a routine service or a specialist LPG need.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000013"
    ]
  },
  "visual": {
    "brandColors": [
      "#0F4C81"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000014"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "3194519b736d7c9bb1cf9cf21c76d5e79d15469e012ac31bdf884a0dbb3ca5dc"
} as const satisfies ProspectPreviewComposition;
