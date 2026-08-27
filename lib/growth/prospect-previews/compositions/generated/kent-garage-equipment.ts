import type { ProspectPreviewComposition } from "../types";

export const kentGarageEquipmentComposition = {
  "schemaVersion": "1.0",
  "prospectId": "20a1e2fd-6f28-43b3-a4b6-12dda6017c66",
  "slug": "kent-garage-equipment",
  "family": "automotive",
  "visualDirection": "calm-architectural",
  "heroTreatment": "service-map",
  "sectionOrder": [
    "hero",
    "services",
    "proof",
    "locality",
    "journey",
    "owner-cta"
  ],
  "journey": {
    "type": "mot-request",
    "completionMessage": "Your preferred time is ready for a follow-up."
  },
  "copy": {
    "businessName": "Kent Garage Equipment",
    "locality": "Chatham",
    "headline": "Vehicle care made easier to book in Chatham.",
    "primaryCta": "Start a workshop equipment enquiry"
  },
  "content": {
    "businessGoal": "Help workshop operators identify the right equipment or service and submit a well-qualified enquiry.",
    "homepageSections": {
      "schemaVersion": "1.0",
      "summary": "Lead with design, supply and installation, then offer needs-led entry points.",
      "items": [
        "Show the main buyer journeys before the detailed brand and product catalogue."
      ]
    },
    "conversionPlan": {
      "schemaVersion": "1.0",
      "summary": "Collect the minimum project details required for an informed response.",
      "items": [
        "Ask for enquiry type, equipment category, site location and target timing."
      ]
    },
    "trustSignals": {
      "schemaVersion": "1.0",
      "summary": "Preserve product depth and strengthen supporting compliance content.",
      "items": [
        "Replace privacy-policy template placeholders with approved company-specific wording."
      ]
    }
  },
  "digest": "dac04fc05b15c1edf2185098999216a6a632ce480edb7f6e6cc75380feff6b34"
} as const satisfies ProspectPreviewComposition;
