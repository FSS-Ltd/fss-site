import type { ProspectPreviewComposition } from "../types";

export const doorknobsComposition = {
  "schemaVersion": "1.1",
  "prospectId": "fed7f3ad-b90c-47ce-a64f-308b7bfe847d",
  "slug": "doorknobs",
  "family": "property",
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
    "businessName": "Doorknobs",
    "locality": "Tunbridge Wells",
    "headline": "Start the property conversation with the route that matches your next move.",
    "primaryCta": "Choose your property journey"
  },
  "content": {
    "businessGoal": "Turn qualified property clients into enquiries that arrive with enough context for a useful response.",
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
        "Each profile could lead to a relevant next step for sellers, landlords, buyers or tenants instead of ending with biography text.",
        "A guided enquiry could ask which property journey applies and collect the matching location and timing details.",
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
    "title": "Choose your property journey",
    "primaryCta": "Choose your property journey",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "property-route",
        "label": "What do you need help with?",
        "kind": "needs-selection",
        "control": "single-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Selling",
          "Letting a property",
          "Buying",
          "Renting"
        ]
      },
      {
        "id": "timing",
        "label": "When would you like to move forward?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "This month",
          "Within three months",
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
    "statement": "Start the property conversation with the route that matches your next move.",
    "supportingStatement": "Doorknobs can route sellers, landlords, buyers and tenants to the right local next step.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000005"
    ]
  },
  "visual": {
    "brandColors": [
      "#FFFFFF"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000006"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "f08766e9b50183971d6a67f809823a9ed8d15dc7e8df2af322e7a6f08a62fe7c"
} as const satisfies ProspectPreviewComposition;
