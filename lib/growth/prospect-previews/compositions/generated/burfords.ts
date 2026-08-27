import type { ProspectPreviewComposition } from "../types";

export const burfordsComposition = {
  "schemaVersion": "1.1",
  "prospectId": "1a0c80dc-e163-44ee-b975-3bea9aec2c85",
  "slug": "burfords",
  "family": "professional-services",
  "visualDirection": "warm-editorial",
  "heroTreatment": "ledger-grid",
  "sectionOrder": [
    "hero",
    "locality",
    "case-for-change",
    "services",
    "journey",
    "proof",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Burfords",
    "locality": "Welling",
    "headline": "Chartered certified accountancy support across company secretarial, payroll and accounts production.",
    "primaryCta": "Choose accountancy support"
  },
  "content": {
    "businessGoal": "Help prospective clients match their need to Burfords expertise and make a well-scoped enquiry.",
    "homepageSections": {
      "schemaVersion": "1.0",
      "summary": "Connect the partner-led proposition, client needs, relevant services and team expertise in sequence.",
      "items": [
        "Replace placeholder testimonial cards with approved evidence or remove them until content is ready."
      ]
    },
    "conversionPlan": {
      "schemaVersion": "1.0",
      "summary": "Qualify enquiries with a short, accessible form.",
      "items": [
        "Add service need, business stage and preferred response timeframe to the contact journey."
      ]
    },
    "trustSignals": {
      "schemaVersion": "1.0",
      "summary": "Use the detailed team biographies as the primary trust layer.",
      "items": [
        "Link each service journey to the relevant named expertise and professional qualifications."
      ]
    }
  },
  "journey": {
    "type": "evidence-backed",
    "title": "Start the right accountancy conversation",
    "primaryCta": "Choose accountancy support",
    "completionMessage": "Your accountancy enquiry is ready for Burfords to review.",
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
          "Company secretarial",
          "Payroll bureau",
          "Accounts production",
          "Taxation and VAT"
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
    "statement": "Chartered certified accountancy support across company secretarial, payroll and accounts production.",
    "supportingStatement": "Start with the work that needs attention, then give Burfords the context for a useful conversation.",
    "evidenceIds": [
      "95fdaf6c-47ab-49f2-904f-ec3ebe260bbb"
    ]
  },
  "visual": {
    "brandColors": [
      "#176CAE",
      "#0B80D6"
    ],
    "colourEvidenceIds": [
      "713370d1-818e-4dd4-9b88-f9357e70cd45"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "3861e6fa58e9286024b7f0eab7d9d00633e8f3c2ae12e4f9a8391548a889c1d1"
} as const satisfies ProspectPreviewComposition;
