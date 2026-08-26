import { z } from "zod";

import {
  hasCanonicalEmailHtmlText,
  isSafeEmailHtml,
} from "../email/html-policy";
import { MAX_RESEARCH_BUNDLE_BYTES } from "./limits";
import {
  RESEARCH_REJECTION_REASON_CODES,
  type AssessmentSectionCandidate,
  type BusinessCandidate,
  type ContactCandidate,
  type EmailVisualCandidate,
  type EvidenceCandidate,
  type FirstEmailCandidate,
  type ProspectCandidate,
  type RejectedResearchCandidate,
  type ResearchProspectCandidate,
  type ResearchRunIngestion,
  type WebsiteEmailNarrative,
  type WebsiteAssessmentCandidate,
} from "./types";

const PERSONAL_MAILBOX_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
  "yahoo.co.uk",
]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getUrlHostname(value: string): string {
  return parseUrl(value)?.hostname ?? "";
}

function isHttpUrl(value: string): boolean {
  const protocol = parseUrl(value)?.protocol;
  return protocol === "http:" || protocol === "https:";
}

function hostsAreRelated(left: string, right: string): boolean {
  return (
    left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)
  );
}

function isGoogleMapsReferenceUrl(value: string): boolean {
  const url = parseUrl(value);
  if (url === null) {
    return false;
  }

  return (
    url.hostname === "maps.google.com" ||
    url.hostname === "maps.app.goo.gl" ||
    (url.hostname === "www.google.com" && url.pathname.startsWith("/maps"))
  );
}

const requiredText = (label: string, maximumLength = 2000) =>
  z
    .string()
    .max(maximumLength, `${label} exceeds the maximum length.`)
    .refine((value) => value.trim().length > 0, {
      message: `${label} is required.`,
    });
const webUrl = z
  .string()
  .max(2048, "Source URL exceeds the maximum length.")
  .url("A valid source URL is required.")
  .refine(isHttpUrl, "Source URL must use HTTP or HTTPS.");
const instant = z.iso.datetime({ offset: true });
const nonnegativePence = z
  .number()
  .int("Money must use integer pence.")
  .nonnegative("Money cannot be negative.");

const businessCandidateSchema: z.ZodType<BusinessCandidate> = z
  .object({
    legalName: requiredText("Legal name", 200),
    tradingName: requiredText("Trading name", 200).nullable(),
    companyNumber: requiredText("Company number", 32),
    corporateType: z.enum(
      ["limited_company", "llp", "scottish_partnership", "other_corporate"],
      { message: "A supported corporate type is required." },
    ),
    corporateStatus: z.enum(["active"], {
      message: "An active company is required.",
    }),
    sector: requiredText("Sector", 120),
    locality: requiredText("Locality", 120),
    county: z.enum(["Kent"], { message: "County must be Kent." }),
    websiteUrl: webUrl.nullable(),
    googlePlaceId: requiredText("Google place ID", 256).nullable(),
    googleMapsReferenceUrl: webUrl.nullable(),
    firstPartySourceUrl: webUrl,
    verifiedAt: instant,
  })
  .strict()
  .superRefine((business, context) => {
    if (
      business.googleMapsReferenceUrl !== null &&
      !isGoogleMapsReferenceUrl(business.googleMapsReferenceUrl)
    ) {
      context.addIssue({
        code: "custom",
        path: ["googleMapsReferenceUrl"],
        message: "Google Maps reference URL must use an approved Maps host.",
      });
    }
  });

const contactCandidateSchema: z.ZodType<ContactCandidate> = z
  .object({
    firstName: requiredText("First name", 120),
    lastName: requiredText("Last name", 120),
    roleTitle: requiredText("Role title", 160).nullable(),
    email: z
      .string()
      .max(320, "Work email exceeds the maximum length.")
      .email("A valid work email is required."),
    emailSourceUrl: webUrl,
    emailVerifiedAt: instant,
    subscriberType: z.enum(["corporate"], {
      message: "A corporate subscriber is required.",
    }),
    lawfulBasis: z.enum(["legitimate_interests"], {
      message: "Legitimate interests is required for cold outreach.",
    }),
    mailboxType: z.enum(["corporate", "personal"]),
  })
  .strict()
  .superRefine((contact, context) => {
    const domain = contact.email.split("@").at(-1)?.toLowerCase() ?? "";
    const isPersonalMailbox =
      contact.mailboxType === "personal" ||
      PERSONAL_MAILBOX_DOMAINS.has(domain);

    if (isPersonalMailbox) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message:
          "A personal mailbox requires manual review outside automated ingestion.",
      });
    }
  });

const prospectCandidateSchema: z.ZodType<ProspectCandidate> = z
  .object({
    fitScore: z
      .number()
      .int("Fit score must be an integer.")
      .min(0, "Fit score must be between 0 and 100.")
      .max(100, "Fit score must be between 0 and 100."),
    opportunitySummary: requiredText("Opportunity summary", 2000),
    recommendedOffer: requiredText("Recommended offer", 500),
    estimatedOneOffMinPence: nonnegativePence,
    estimatedOneOffMaxPence: nonnegativePence,
    estimatedMonthlyPence: nonnegativePence,
    nextAction: requiredText("Next action", 500).nullable(),
    nextActionDueAt: instant.nullable(),
  })
  .strict()
  .superRefine((prospect, context) => {
    if (prospect.estimatedOneOffMaxPence < prospect.estimatedOneOffMinPence) {
      context.addIssue({
        code: "custom",
        path: ["estimatedOneOffMaxPence"],
        message: "Maximum one-off value cannot be below the minimum.",
      });
    }
  });

const evidenceCandidateSchema: z.ZodType<EvidenceCandidate> = z
  .object({
    sourceType: z.enum([
      "companies_house",
      "first_party",
      "google_maps_reference",
    ]),
    sourceUrl: webUrl,
    externalReference: requiredText("External reference", 500).nullable(),
    claimType: requiredText("Claim type", 120),
    claimSummary: requiredText("Claim summary", 2000),
    observedAt: instant,
    verifiedAt: instant,
    retentionClass: z.enum(["legal_evidence", "prospect_research"]),
  })
  .strict();

const assessmentSectionSchema: z.ZodType<AssessmentSectionCandidate> = z
  .object({
    schemaVersion: z.enum(["1.0"], {
      message: "Assessment schema version must be 1.0.",
    }),
    summary: requiredText("Assessment summary", 2000),
    items: z.array(requiredText("Assessment item", 1000)).min(1).max(30),
  })
  .strict();

const websiteAssessmentCandidateSchema: z.ZodType<WebsiteAssessmentCandidate> =
  z
    .object({
      businessGoal: requiredText("Business goal", 2000),
      primaryCta: requiredText("Primary CTA", 500),
      sitemap: assessmentSectionSchema,
      homepageSections: assessmentSectionSchema,
      conversionPlan: assessmentSectionSchema,
      localSeoPlan: assessmentSectionSchema,
      trustSignals: assessmentSectionSchema,
      technologyPlan: assessmentSectionSchema,
      futureOpportunities: assessmentSectionSchema,
      heroConcept: assessmentSectionSchema,
      mobileFallback: assessmentSectionSchema,
      performanceBudget: assessmentSectionSchema,
    })
    .strict();

const firstEmailCandidateSchema: z.ZodType<FirstEmailCandidate> = z
  .object({
    subject: requiredText("Email subject", 200),
    html: requiredText("Email HTML", 50000),
    text: requiredText("Email text", 20000),
    wordCount: z
      .number()
      .int("Email word count must be an integer.")
      .min(140, "First email must contain at least 140 words.")
      .max(220, "First email must contain no more than 220 words."),
    optOutSentence: requiredText("Email opt-out sentence", 500),
    conceptDisclaimer: requiredText("Email concept disclaimer", 500),
  })
  .strict()
  .superRefine((email, context) => {
    const actualWordCount = email.text.trim().split(/\s+/).length;
    if (email.wordCount !== actualWordCount) {
      context.addIssue({
        code: "custom",
        path: ["wordCount"],
        message: "Declared email word count must match the plain text email.",
      });
    }

    if (!isSafeEmailHtml(email.html)) {
      context.addIssue({
        code: "custom",
        path: ["html"],
        message: "First email must use the safe email HTML allowlist.",
      });
    }

    if (
      !/opt[ -]?out|no further emails|not hear from me/i.test(
        email.optOutSentence,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["optOutSentence"],
        message: "Email opt-out sentence must offer a direct opt-out.",
      });
    }

    for (const field of ["html", "text"] as const) {
      const containsOptOut =
        field === "html"
          ? hasCanonicalEmailHtmlText(email.html, email.optOutSentence)
          : email.text.includes(email.optOutSentence);
      if (!containsOptOut) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `Email ${field} must contain the opt-out sentence.`,
        });
      }
      const containsDisclaimer =
        field === "html"
          ? hasCanonicalEmailHtmlText(email.html, email.conceptDisclaimer)
          : email.text.includes(email.conceptDisclaimer);
      if (!containsDisclaimer) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `Email ${field} must contain the concept disclaimer.`,
        });
      }
    }
  });

const websiteEmailNarrativeSchema: z.ZodType<WebsiteEmailNarrative> = z
  .object({
    openingStrength: z
      .object({
        text: requiredText("Opening strength", 1_000),
        evidenceSourceUrl: webUrl,
        kind: z.enum([
          "first_party_review",
          "first_party_service",
          "first_party_work",
        ]),
      })
      .strict(),
    improvements: z
      .array(
        z
          .object({
            text: requiredText("Website improvement", 1_000),
            evidenceSourceUrl: webUrl,
          })
          .strict(),
      )
      .min(2)
      .max(3),
  })
  .strict();

export function parseFirstEmailCandidate(value: unknown): FirstEmailCandidate {
  return firstEmailCandidateSchema.parse(value);
}

const emailVisualCandidateSchema: z.ZodType<EmailVisualCandidate> = z
  .object({
    assetId: z.null({
      message:
        "Custom visuals must be uploaded after the research run creates prospect IDs.",
    }),
    fallbackAssetKey: requiredText("Fallback asset key", 120),
    altText: z
      .string()
      .refine((value) => value.trim().length >= 20, {
        message: "Image alt text must contain at least 20 characters.",
      })
      .refine((value) => value.length <= 1000, {
        message: "Image alt text exceeds the maximum length.",
      }),
    conceptDisclaimer: requiredText("Image concept disclaimer", 500),
  })
  .strict();

const researchProspectCandidateSchema: z.ZodType<ResearchProspectCandidate> = z
  .object({
    business: businessCandidateSchema,
    contact: contactCandidateSchema,
    prospect: prospectCandidateSchema,
    evidence: z.array(evidenceCandidateSchema).min(1).max(25),
    assessment: websiteAssessmentCandidateSchema,
    firstEmail: firstEmailCandidateSchema,
    emailNarrative: websiteEmailNarrativeSchema,
    visual: emailVisualCandidateSchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    const businessHosts = [
      getUrlHostname(candidate.business.firstPartySourceUrl),
      candidate.business.websiteUrl
        ? getUrlHostname(candidate.business.websiteUrl)
        : "",
    ].filter((host) => host.length > 0);
    const emailDomain =
      candidate.contact.email.split("@").at(-1)?.toLowerCase() ?? "";

    if (!businessHosts.some((host) => hostsAreRelated(emailDomain, host))) {
      context.addIssue({
        code: "custom",
        path: ["contact", "email"],
        message:
          "The work email domain must match a verified first-party business host.",
      });
    }

    const companiesHouseEvidence = candidate.evidence.filter(
      (evidence) => evidence.sourceType === "companies_house",
    );

    if (companiesHouseEvidence.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Companies House evidence is required.",
      });
    }

    const normaliseCompanyNumber = (value: string) =>
      value.replace(/\s+/g, "").toUpperCase();
    const companyNumber = normaliseCompanyNumber(
      candidate.business.companyNumber,
    );

    for (const evidence of companiesHouseEvidence) {
      if (
        evidence.externalReference === null ||
        normaliseCompanyNumber(evidence.externalReference) !== companyNumber
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message:
            "Companies House evidence must reference the business company number.",
        });
      }

      const sourceUrl = parseUrl(evidence.sourceUrl);
      if (sourceUrl === null) {
        continue;
      }
      const profileSegments = sourceUrl.pathname.split("/").filter(Boolean);
      if (
        sourceUrl.hostname !==
        "find-and-update.company-information.service.gov.uk"
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message:
            "Companies House evidence must use the official profile URL.",
        });
      }

      if (
        profileSegments.length !== 2 ||
        profileSegments[0] !== "company" ||
        normaliseCompanyNumber(profileSegments[1] ?? "") !== companyNumber
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message:
            "Companies House profile URL must contain the business company number.",
        });
      }
    }

    for (const evidence of candidate.evidence) {
      if (evidence.sourceType !== "google_maps_reference") {
        continue;
      }

      if (
        evidence.claimType !== "discovery_reference" ||
        evidence.claimSummary !== "Google Maps discovery reference only."
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message:
            "Google Maps evidence may record a discovery reference only.",
        });
      }

      if (
        candidate.business.googlePlaceId === null ||
        candidate.business.googleMapsReferenceUrl === null ||
        evidence.externalReference !== candidate.business.googlePlaceId ||
        evidence.sourceUrl !== candidate.business.googleMapsReferenceUrl
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message:
            "Google Maps evidence must match the business place ID and reference URL.",
        });
      }
    }

    if (
      !candidate.evidence.some(
        (evidence) => evidence.sourceType === "first_party",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "First-party evidence is required for the opportunity.",
      });
    }

    for (const [index, evidence] of candidate.evidence.entries()) {
      if (
        evidence.sourceType === "first_party" &&
        !businessHosts.some((host) =>
          hostsAreRelated(getUrlHostname(evidence.sourceUrl), host),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence", index, "sourceUrl"],
          message:
            "First-party evidence host must match the verified business host.",
        });
      }
    }

    const narrativeEvidence = [
      candidate.emailNarrative.openingStrength,
      ...candidate.emailNarrative.improvements,
    ];

    for (const [index, observation] of narrativeEvidence.entries()) {
      const matchingEvidence = candidate.evidence.find(
        (evidence) => evidence.sourceUrl === observation.evidenceSourceUrl,
      );
      if (matchingEvidence?.sourceType !== "first_party") {
        context.addIssue({
          code: "custom",
          path:
            index === 0
              ? ["emailNarrative", "openingStrength", "evidenceSourceUrl"]
              : [
                  "emailNarrative",
                  "improvements",
                  index - 1,
                  "evidenceSourceUrl",
                ],
          message:
            "Initial-email narrative observations must use recorded first-party evidence.",
        });
      }
    }

    if (
      candidate.visual.conceptDisclaimer !==
      candidate.firstEmail.conceptDisclaimer
    ) {
      context.addIssue({
        code: "custom",
        path: ["visual", "conceptDisclaimer"],
        message: "Image and email concept disclaimers must match.",
      });
    }
  });

const rejectedResearchCandidateSchema: z.ZodType<RejectedResearchCandidate> = z
  .object({
    candidateName: requiredText("Rejected candidate name", 200),
    reasonCode: z.enum(RESEARCH_REJECTION_REASON_CODES, {
      message: "A supported rejection reason code is required.",
    }),
    sourceUrl: webUrl.optional(),
  })
  .strict();

export const researchRunIngestionSchema: z.ZodType<ResearchRunIngestion> = z
  .object({
    schemaVersion: z.enum(["1.0"], {
      message: "Research schema version must be 1.0.",
    }),
    externalRunId: requiredText("External run ID", 160),
    runDate: z.iso.date(),
    timezone: z.enum(["Europe/London"], {
      message: "Research timezone must be Europe/London.",
    }),
    promptVersion: requiredText("Prompt version", 120),
    prospects: z.array(researchProspectCandidateSchema).max(10),
    rejections: z.array(rejectedResearchCandidateSchema).max(100),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.prospects.length === 0 && run.rejections.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["prospects"],
        message: "A research run must contain at least one candidate.",
      });
    }

    const canonicalBytes = new TextEncoder().encode(
      JSON.stringify(run),
    ).byteLength;
    if (canonicalBytes > MAX_RESEARCH_BUNDLE_BYTES) {
      context.addIssue({
        code: "custom",
        message: "Research bundle serialized size exceeds 4 MB.",
      });
    }
  });

export function parseResearchRunIngestion(
  input: unknown,
): ResearchRunIngestion {
  return researchRunIngestionSchema.parse(input);
}
