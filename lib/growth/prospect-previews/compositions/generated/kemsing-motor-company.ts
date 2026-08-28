import type { ProspectPreviewComposition } from "../types";

export const kemsingMotorCompanyComposition = {
  "schemaVersion": "1.1",
  "prospectId": "dbc85031-f39f-49e5-9bfc-973a44a1f618",
  "slug": "kemsing-motor-company",
  "family": "automotive",
  "visualDirection": "calm-architectural",
  "heroTreatment": "crafted-table",
  "sectionOrder": [
    "hero",
    "services",
    "case-for-change",
    "proof",
    "journey",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Kemsing Motor Company",
    "locality": "Kemsing",
    "headline": "Start your MOT, diagnostic, service or repair request with the vehicle details Kemsing needs.",
    "primaryCta": "Prepare your vehicle request"
  },
  "content": {
    "businessGoal": "Turn qualified motorists into enquiries that arrive with enough context for a useful response.",
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
        "The current name, email and message form could also collect vehicle registration, make and model.",
        "Visitors could choose a service category and preferred timing before submitting the request.",
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
    "title": "Prepare your vehicle request",
    "primaryCta": "Prepare your vehicle request",
    "completionMessage": "This demonstration prepares a request for a considered follow-up.",
    "steps": [
      {
        "id": "registration",
        "label": "Vehicle registration",
        "kind": "vehicle-registration",
        "control": "registration",
        "requiredFields": [
          "registration"
        ],
        "options": []
      },
      {
        "id": "service",
        "label": "What does your vehicle need?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "MOT",
          "Diagnostics",
          "Service",
          "Repair"
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
    "statement": "Start your MOT, diagnostic, service or repair request with the vehicle details Kemsing needs.",
    "supportingStatement": "Registration, service type and timing can make the garage conversation ready before booking review.",
    "evidenceIds": [
      "10000000-0000-4000-8000-000000000011"
    ]
  },
  "visual": {
    "brandColors": [
      "#243A7A"
    ],
    "colourEvidenceIds": [
      "10000000-0000-4000-8000-000000000012"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "e7179d44b76034a8d9040123db37221326e343c75ee41e040dc37ce0683ffa9c"
} as const satisfies ProspectPreviewComposition;
