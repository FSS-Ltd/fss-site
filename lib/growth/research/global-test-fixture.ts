export function createGlobalResearchFixture() {
  const text =
    "Hello, your site describes telephone appointment requests. A simple booking portal could let customers request a slot online while you keep control of availability. Would a short outline help? Reply to opt out of further emails.";
  const verifiedAt = "2026-10-26T08:00:00Z";
  return {
    schemaVersion: "2.0" as const,
    externalRunId: "global-test-run",
    runDate: "2026-10-26",
    timezone: "Europe/London" as const,
    promptVersion: "global-v2",
    prospects: [
      {
        business: {
          legalName: "Example business",
          tradingName: null,
          companyNumber: null,
          countryCode: "CA",
          corporateType: "sole_trader" as const,
          corporateStatus: "active" as const,
          sector: "Home services",
          locality: "Toronto",
          county: null,
          websiteUrl: "https://example.test",
          googlePlaceId: null,
          googleMapsReferenceUrl: null,
          firstPartySourceUrl: "https://example.test/contact",
          verifiedAt,
        },
        contact: {
          firstName: null,
          lastName: null,
          roleTitle: null,
          email: "example-business@gmail.com",
          emailSourceUrl: "https://example.test/contact",
          emailVerifiedAt: verifiedAt,
          subscriberType: "individual" as const,
        },
        prospect: {
          fitScore: 75,
          opportunitySummary: "Appointment requests are handled by telephone.",
          recommendedOffer: "Booking portal",
        },
        evidence: [
          {
            sourceType: "first_party" as const,
            sourceUrl: "https://example.test/contact",
            externalReference: null,
            claimType: "contact_and_booking",
            claimSummary:
              "Public business email and telephone booking information.",
            observedAt: verifiedAt,
            verifiedAt,
            retentionClass: "prospect_research" as const,
          },
        ],
        firstEmail: {
          subject: "appointment requests",
          text,
          html: `<p>${text}</p>`,
          wordCount: text.split(/\s+/).length,
          optOutSentence: "Reply to opt out of further emails.",
        },
      },
    ],
    rejections: [],
  };
}
