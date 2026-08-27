import type { ProspectPreviewComposition } from "../types";

export const mardenGarageComposition = {
  "schemaVersion": "1.1",
  "prospectId": "b759f698-0852-4ed0-acc7-62d55ab0adb0",
  "slug": "marden-garage",
  "family": "automotive",
  "visualDirection": "precision-dark",
  "heroTreatment": "crafted-table",
  "sectionOrder": [
    "hero",
    "case-for-change",
    "services",
    "proof",
    "journey",
    "locality",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Marden Garage",
    "locality": "Marden",
    "headline": "Start your MOT, service or repair request with your registration.",
    "primaryCta": "Start with your registration"
  },
  "content": {
    "businessGoal": "A single vehicle-service request could prepare MOT, repair and recovery enquiries before workshop follow-up.",
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
        "vehicle and service details",
        "warning signs and preferred timing",
        "a clear workshop summary"
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
    "title": "Get your vehicle ready for the workshop",
    "primaryCta": "Start with your registration",
    "completionMessage": "Your workshop request is ready for Marden Garage to review.",
    "steps": [
      {
        "id": "vehicle",
        "label": "Tell us about your vehicle",
        "kind": "vehicle-registration",
        "control": "registration",
        "requiredFields": [
          "registration"
        ],
        "options": []
      },
      {
        "id": "service",
        "label": "What do you need help with?",
        "kind": "service-selection",
        "control": "single-select",
        "requiredFields": [
          "service"
        ],
        "options": [
          "MOT",
          "Service",
          "Repair"
        ]
      },
      {
        "id": "timing",
        "label": "When would you like to visit?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "This week",
          "Next week",
          "I am flexible"
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
    "statement": "Start your MOT, service or repair request with your registration.",
    "supportingStatement": "Marden Garage can see the right vehicle details before arranging the next workshop step.",
    "evidenceIds": [
      "6fdb6c56-4955-407c-aeae-7cda91341a42"
    ]
  },
  "visual": {
    "brandColors": [
      "#226D7A",
      "#B0E0E9"
    ],
    "colourEvidenceIds": [
      "639d4845-69cd-4494-b3af-b364303687aa"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "4eeccf885d539324d7d6a3aa3411fc74fcc0a4208cc5a7184dc02c231e8ec754"
} as const satisfies ProspectPreviewComposition;
