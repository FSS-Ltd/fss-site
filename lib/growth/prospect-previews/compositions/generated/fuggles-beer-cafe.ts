import type { ProspectPreviewComposition } from "../types";

export const fugglesBeerCafeComposition = {
  "schemaVersion": "1.0",
  "prospectId": "67323610-eca8-4fd5-8ef2-4da5bf11f45d",
  "slug": "fuggles-beer-cafe",
  "family": "hospitality",
  "visualDirection": "precision-dark",
  "heroTreatment": "property-frame",
  "sectionOrder": [
    "hero",
    "locality",
    "services",
    "case-for-change",
    "journey",
    "owner-cta"
  ],
  "journey": {
    "type": "table-enquiry",
    "completionMessage": "Your table enquiry is ready for a considered reply."
  },
  "copy": {
    "businessName": "Fuggles Beer Cafe",
    "locality": "Tunbridge Wells",
    "headline": "A more considered first welcome in Tunbridge Wells.",
    "primaryCta": "Plan a special booking"
  },
  "content": {
    "businessGoal": "Special-event and venue-specific requests could use one structured path while normal table reservations remain unchanged.",
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
        "venue and occasion selection",
        "group size, date and requirements",
        "a booking-team summary"
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
  "digest": "bd68c16a8b04f4f5b9f699e7a31d8b5d93b67bb51ac513604d9678c8441f59fb"
} as const satisfies ProspectPreviewComposition;
