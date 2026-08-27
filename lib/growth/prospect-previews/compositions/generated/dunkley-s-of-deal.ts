import type { ProspectPreviewComposition } from "../types";

export const dunkleySOfDealComposition = {
  "schemaVersion": "1.1",
  "prospectId": "cfc1ee0a-3f0b-49f8-9be3-e371311958a5",
  "slug": "dunkley-s-of-deal",
  "family": "automotive",
  "visualDirection": "precision-dark",
  "heroTreatment": "workshop-geometry",
  "sectionOrder": [
    "hero",
    "proof",
    "services",
    "journey",
    "locality",
    "owner-cta"
  ],
  "copy": {
    "businessName": "Dunkley's of Deal",
    "locality": "Deal",
    "headline": "Start an MOT, service or commercial-vehicle request with the right vehicle details.",
    "primaryCta": "Start with your registration"
  },
  "content": {
    "businessGoal": "Vehicle and service details could be captured online before MOT, repair or commercial-vehicle availability is confirmed.",
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
        "vehicle class and registration",
        "service need and preferred date",
        "an organised workshop hand-off"
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
    "completionMessage": "Your workshop request is ready for Dunkley's to review.",
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
          "Same-day MOT",
          "Car servicing",
          "Commercial vehicle servicing",
          "Motorhome MOT"
        ]
      },
      {
        "id": "timing",
        "label": "When do you need the workshop?",
        "kind": "timing",
        "control": "single-select",
        "requiredFields": [
          "timing"
        ],
        "options": [
          "Today",
          "This week",
          "Next week"
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
    "statement": "Start an MOT, service or commercial-vehicle request with the right vehicle details.",
    "supportingStatement": "Dunkley's provides same-day MOTs alongside car, motorhome and commercial servicing in Deal.",
    "evidenceIds": [
      "d56a12d0-b0d5-4fe2-b398-1a61466f99fd"
    ]
  },
  "visual": {
    "brandColors": [
      "#888888"
    ],
    "colourEvidenceIds": [
      "b1a64369-38a7-49ef-a857-847b7d5929a8"
    ],
    "logoEvidenceId": null,
    "logoAssetId": null,
    "onSiteImageEvidenceId": null,
    "onSiteImageAssetId": null,
    "approvedHeroMediaAssetId": null
  },
  "digest": "f9214343949ab16828511b2cdc88803380e0bfab9ae0fdf46d40540586253bd5"
} as const satisfies ProspectPreviewComposition;
