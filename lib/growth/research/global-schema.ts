import { z } from "zod";
import { emailHtmlVisibleText, isSafeEmailHtml } from "../email/html-policy";
import { MAX_RESEARCH_BUNDLE_BYTES } from "./limits";

const COUNTRY_CODES = new Set(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  ),
);
const text = (max = 2000) => z.string().trim().min(1).max(max);
function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
const url = z
  .url()
  .max(2048)
  .refine((value) =>
    ["http:", "https:"].includes(parseUrl(value)?.protocol ?? ""),
  )
  .transform((value) => new URL(value).href);
const instant = z.iso.datetime({ offset: true });
const nullableName = text(120).nullable();
const money = z.number().int().nonnegative().default(0);
const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

export const globalFirstEmailSchema = z
  .object({
    subject: text(200).refine(
      (value) => !/[\r\n]/.test(value),
      "Subject cannot contain line breaks.",
    ),
    html: text(50_000),
    text: text(20_000),
    wordCount: z.number().int().min(20).max(220),
    optOutSentence: text(500),
  })
  .strict()
  .superRefine((email, context) => {
    if (
      !isSafeEmailHtml(email.html) ||
      normalizeText(emailHtmlVisibleText(email.html)) !==
        normalizeText(email.text)
    ) {
      context.addIssue({
        code: "custom",
        path: ["html"],
        message: "Safe HTML must match the plain text email.",
      });
    }
    if (email.text.split(/\s+/).length !== email.wordCount) {
      context.addIssue({
        code: "custom",
        path: ["wordCount"],
        message: "Declared word count must match the email.",
      });
    }
    if (
      !/opt[ -]?out|no further emails|not hear from me/i.test(
        email.optOutSentence,
      ) ||
      !email.text.includes(email.optOutSentence)
    ) {
      context.addIssue({
        code: "custom",
        path: ["optOutSentence"],
        message: "Email must include its direct opt-out sentence.",
      });
    }
  });

const evidenceSchema = z
  .object({
    sourceType: z.enum([
      "first_party",
      "business_registry",
      "google_maps_reference",
    ]),
    sourceUrl: url,
    externalReference: text(500).nullable(),
    claimType: text(120),
    claimSummary: text(),
    observedAt: instant,
    verifiedAt: instant,
    retentionClass: z.enum(["legal_evidence", "prospect_research"]),
  })
  .strict();

export const globalCandidateSchema = z
  .object({
    business: z
      .object({
        legalName: text(200),
        tradingName: text(200).nullable(),
        companyNumber: text(100).nullable(),
        countryCode: z
          .string()
          .refine(
            (value) => COUNTRY_CODES.has(value),
            "An ISO 3166-1 alpha-2 country code is required.",
          ),
        corporateType: z.enum([
          "limited_company",
          "llp",
          "scottish_partnership",
          "other_corporate",
          "sole_trader",
          "partnership",
          "nonprofit",
          "other",
          "unknown",
        ]),
        corporateStatus: z.literal("active"),
        sector: text(120),
        locality: text(120),
        county: text(120).nullable(),
        websiteUrl: url.nullable(),
        googlePlaceId: text(256).nullable(),
        googleMapsReferenceUrl: url.nullable(),
        firstPartySourceUrl: url,
        verifiedAt: instant,
      })
      .strict(),
    contact: z
      .object({
        firstName: nullableName,
        lastName: nullableName,
        roleTitle: text(160).nullable(),
        email: z
          .email()
          .max(320)
          .transform((value) => value.toLowerCase()),
        emailSourceUrl: url,
        emailVerifiedAt: instant,
        subscriberType: z.enum(["corporate", "individual", "uncertain"]),
      })
      .strict(),
    prospect: z
      .object({
        fitScore: z.number().int().min(0).max(100),
        opportunitySummary: text(),
        recommendedOffer: text(500),
        estimatedOneOffMinPence: money,
        estimatedOneOffMaxPence: money,
        estimatedMonthlyPence: money,
        nextAction: text(500).nullable().default(null),
        nextActionDueAt: instant.nullable().default(null),
      })
      .strict()
      .refine(
        (value) =>
          value.estimatedOneOffMaxPence >= value.estimatedOneOffMinPence,
        "Maximum estimate must not be below the minimum.",
      ),
    evidence: z.array(evidenceSchema).min(1).max(25),
    firstEmail: globalFirstEmailSchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    const firstParty = candidate.evidence.filter(
      (item) => item.sourceType === "first_party",
    );
    const host = parseUrl(candidate.business.firstPartySourceUrl)?.hostname;
    const relatedHost = (value: string) => {
      const other = parseUrl(value)?.hostname;
      if (!host || !other) return false;
      return (
        other === host ||
        other.endsWith(`.${host}`) ||
        host.endsWith(`.${other}`)
      );
    };
    if (
      !firstParty.some(
        (item) => item.sourceUrl === candidate.contact.emailSourceUrl,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["contact", "emailSourceUrl"],
        message:
          "Public contact source must have recorded first-party evidence.",
      });
    }
    if (
      firstParty.some((item) => !relatedHost(item.sourceUrl)) ||
      (candidate.business.websiteUrl !== null &&
        !relatedHost(candidate.business.websiteUrl))
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "First-party evidence must match the verified business host.",
      });
    }
    const mapsReference = candidate.business.googleMapsReferenceUrl;
    if (mapsReference !== null) {
      const mapsUrl = parseUrl(mapsReference);
      if (
        !mapsUrl ||
        !(
          mapsUrl.hostname === "maps.google.com" ||
          mapsUrl.hostname === "maps.app.goo.gl" ||
          (mapsUrl.hostname === "www.google.com" &&
            mapsUrl.pathname.startsWith("/maps"))
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["business", "googleMapsReferenceUrl"],
          message: "Maps reference must use an approved Google Maps host.",
        });
      }
    }
    const claims = new Set(
      candidate.evidence.map((item) => `${item.sourceUrl}\n${item.claimType}`),
    );
    if (claims.size !== candidate.evidence.length)
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Evidence source and claim pairs must be unique.",
      });
    for (const item of candidate.evidence.filter(
      (item) => item.sourceType === "google_maps_reference",
    )) {
      if (
        item.externalReference !== candidate.business.googlePlaceId ||
        item.sourceUrl !== candidate.business.googleMapsReferenceUrl ||
        item.claimType !== "discovery_reference" ||
        item.claimSummary !== "Google Maps discovery reference only."
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message: "Maps evidence must match the business discovery reference.",
        });
      }
    }
  });

export const globalResearchRunSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    externalRunId: text(160),
    runDate: z.iso.date(),
    timezone: z.literal("Europe/London"),
    promptVersion: text(120),
    prospects: z.array(globalCandidateSchema).max(10),
    rejections: z
      .array(
        z
          .object({
            candidateName: text(200),
            reasonCode: z.enum([
              "inactive_company",
              "unverifiable_work_email",
              "unsupported_claim",
              "insufficient_opportunity_evidence",
              "known_duplicate",
              "suppressed_contact",
            ]),
            sourceUrl: url.optional(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((run, context) => {
    if (!run.prospects.length && !run.rejections.length)
      context.addIssue({
        code: "custom",
        message: "A run must contain at least one candidate.",
      });
    if (
      new TextEncoder().encode(JSON.stringify(run)).byteLength >
      MAX_RESEARCH_BUNDLE_BYTES
    )
      context.addIssue({
        code: "custom",
        message: "Research bundle exceeds 4 MB.",
      });
  });

export type GlobalResearchCandidate = z.infer<typeof globalCandidateSchema>;
export type GlobalResearchRun = z.infer<typeof globalResearchRunSchema>;
