function assessmentSection(summary: string) {
  return {
    schemaVersion: "1.0" as const,
    summary,
    items: ["Evidence-backed recommendation"],
  };
}

export function createValidResearchRunFixture() {
  const emailWords = Array.from(
    { length: 140 },
    (_, index) => `word${index + 1}`,
  ).join(" ");
  const optOutSentence = "Reply opt out and I will send no further emails.";
  const conceptDisclaimer =
    "This visual is a concept for discussion, not an existing system.";
  const emailText = `${emailWords}\n\n${conceptDisclaimer}\n\n${optOutSentence}`;

  return {
    schemaVersion: "1.0" as const,
    externalRunId: "research-2026-08-17-0600",
    runDate: "2026-08-17",
    timezone: "Europe/London" as const,
    promptVersion: "weekday-research-v1",
    prospects: [
      {
        business: {
          legalName: "Example Services Limited",
          tradingName: "Example Services",
          companyNumber: "12345678",
          corporateType: "limited_company" as const,
          corporateStatus: "active" as const,
          sector: "Home services",
          locality: "Maidstone",
          county: "Kent" as const,
          websiteUrl: "https://example.test",
          googlePlaceId: "place-123",
          googleMapsReferenceUrl: "https://maps.google.com/?cid=123",
          firstPartySourceUrl: "https://example.test/about",
          verifiedAt: "2026-08-17T05:30:00.000Z",
        },
        contact: {
          firstName: "Alex",
          lastName: "Morgan",
          roleTitle: "Director",
          email: "alex@example.test",
          emailSourceUrl: "https://example.test/contact",
          emailVerifiedAt: "2026-08-17T05:35:00.000Z",
          subscriberType: "corporate" as const,
          lawfulBasis: "legitimate_interests" as const,
          mailboxType: "corporate" as const,
        },
        prospect: {
          fitScore: 91,
          opportunitySummary:
            "Manual enquiry handling creates avoidable delay.",
          recommendedOffer: "Website and enquiry workflow",
          estimatedOneOffMinPence: 450000,
          estimatedOneOffMaxPence: 650000,
          estimatedMonthlyPence: 0,
          nextAction: "Review first email",
          nextActionDueAt: "2026-08-17T08:00:00.000Z",
        },
        evidence: [
          {
            sourceType: "companies_house" as const,
            sourceUrl:
              "https://find-and-update.company-information.service.gov.uk/company/12345678",
            externalReference: "12345678",
            claimType: "corporate_status",
            claimSummary: "Active limited company.",
            observedAt: "2026-08-17T05:20:00.000Z",
            verifiedAt: "2026-08-17T05:20:00.000Z",
            retentionClass: "legal_evidence" as const,
          },
          {
            sourceType: "first_party" as const,
            sourceUrl: "https://example.test/services",
            externalReference: null,
            claimType: "service_opportunity",
            claimSummary: "The site directs all enquiries to a general form.",
            observedAt: "2026-08-17T05:25:00.000Z",
            verifiedAt: "2026-08-17T05:25:00.000Z",
            retentionClass: "prospect_research" as const,
          },
        ],
        assessment: {
          businessGoal: "Turn qualified website visits into useful enquiries.",
          primaryCta: "Request a call-back",
          sitemap: assessmentSection("A focused five-page service site."),
          homepageSections: assessmentSection("Lead with problem and service."),
          conversionPlan: assessmentSection(
            "Capture job context before calls.",
          ),
          localSeoPlan: assessmentSection(
            "Use first-party local service pages.",
          ),
          trustSignals: assessmentSection("Present verifiable credentials."),
          technologyPlan: assessmentSection("Use a fast accessible web stack."),
          futureOpportunities: assessmentSection(
            "Connect enquiries to delivery.",
          ),
          heroConcept: assessmentSection("Show an organised enquiry journey."),
          mobileFallback: assessmentSection(
            "Keep the enquiry action prominent.",
          ),
          performanceBudget: assessmentSection("Protect mobile loading speed."),
        },
        firstEmail: {
          subject: "A practical enquiry idea for Example Services",
          html: `<p>${emailWords}</p><p>${conceptDisclaimer}</p><p>${optOutSentence}</p>`,
          text: emailText,
          wordCount: emailText.trim().split(/\s+/).length,
          optOutSentence,
          conceptDisclaimer,
        },
        emailNarrative: {
          openingStrength: {
            text: "The services page gives visitors a direct explanation of the work the business provides.",
            evidenceSourceUrl: "https://example.test/services",
            kind: "first_party_service" as const,
          },
          improvements: [
            {
              text: "The current general form could ask for the details needed before a call-back.",
              evidenceSourceUrl: "https://example.test/services",
            },
            {
              text: "The service journey could give visitors a clearer route to the next step.",
              evidenceSourceUrl: "https://example.test/services",
            },
          ],
        },
        visual: {
          assetId: null,
          fallbackAssetKey: "home-property",
          altText:
            "Concept showing a service enquiry moving into an organised call-back workflow.",
          conceptDisclaimer,
        },
      },
    ],
    rejections: [],
  };
}
