import type { ProspectPreviewComposition } from "../types";

export const clarativeAccountingComposition = {
  "schemaVersion": "1.1",
  "prospectId": "2c795b23-db7d-4a6c-a1ed-d7ad8c1a4893",
  "slug": "clarative-accounting",
  "family": "professional-services",
  "visualDirection": "precision-dark",
  "heroTreatment": "ledger-grid",
  "sectionOrder": [
    "hero",
    "proof",
    "case-for-change",
    "services",
    "journey",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Clarative Accounting",
    "locality": "Maidstone",
    "headline": "Bring clarity to your construction company finances before the next decision.",
    "primaryCta": "Plan your discovery call"
  },
  "content": {
    "businessGoal": "Turn qualified prospective clients into enquiries that arrive with enough context for a useful response.",
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
        "The form could collect the construction company's stage, current accounting setup and most urgent service need.",
        "A short pre-call route could help visitors choose the most relevant service or pricing information first.",
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
    "title": "Plan your discovery call",
    "primaryCta": "Plan your discovery call",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "business-type",
        "label": "What type of construction business are you?",
        "kind": "needs-selection",
        "control": "single-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Builder or contractor",
          "Trade business",
          "Property investor",
          "Professional service"
        ]
      },
      {
        "id": "accounting-need",
        "label": "What would you like to discuss?",
        "kind": "needs-selection",
        "control": "single-select",
        "requiredFields": [
          "need"
        ],
        "options": [
          "Accounts and tax",
          "Cloud accounting",
          "Business advice"
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
    "statement": "Bring clarity to your construction company finances before the next decision.",
    "supportingStatement": "Clarative Accounting combines specialist construction knowledge with a practical discovery conversation.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000001"
    ]
  },
  "visual": {
    "brandColors": [
      "#004A59"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000002"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "e938e0ff066ddebcc3887db0d6cdb568e7a4cda9aa01e8bd48d61c9e1dbc52d6"
} as const satisfies ProspectPreviewComposition;
