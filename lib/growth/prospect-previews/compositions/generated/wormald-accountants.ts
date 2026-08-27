import type { ProspectPreviewComposition } from "../types";

export const wormaldAccountantsComposition = {
  "schemaVersion": "1.1",
  "prospectId": "a0e09bcd-187a-4627-8f09-b0634c27d3d4",
  "slug": "wormald-accountants",
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
    "businessName": "Wormald Accountants",
    "locality": "Maidstone",
    "headline": "Make sense of your numbers with accounting and tax advice built around your business.",
    "primaryCta": "Choose accountancy support"
  },
  "content": {
    "businessGoal": "Prospective clients could be qualified by service need and business type before a member of the accounts team responds.",
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
        "service and entity selection",
        "deadline and document checklist",
        "a structured team summary"
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
    "title": "Start your accountancy conversation",
    "primaryCta": "Choose accountancy support",
    "completionMessage": "Your Wormald Accountants enquiry is ready to review.",
    "steps": [
      {
        "id": "service",
        "label": "What would you like to discuss?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "Accounting and taxation",
          "Business advice",
          "Individual tax",
          "Business tax"
        ]
      },
      {
        "id": "timing",
        "label": "When would you like to talk?",
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
    "statement": "Make sense of your numbers with accounting and tax advice built around your business.",
    "supportingStatement": "Wormald works with clients individually on accounting, taxation and business issues.",
    "evidenceIds": [
      "29daa59f-49ca-4916-9cea-5ba6b2f99aa6"
    ]
  },
  "visual": {
    "brandColors": [
      "#093B9F",
      "#C7071D"
    ],
    "colourEvidenceIds": [
      "85dc65f9-37c6-40a6-bc25-73f77dad58a7"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "41dc7e03b1420250ae8b9b8f460c1c80f6efa8f358bae1767ce2d1da31313d3d"
} as const satisfies ProspectPreviewComposition;
