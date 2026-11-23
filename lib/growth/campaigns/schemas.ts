import { z } from "zod";
import { websiteServiceTermsSchema } from "./website-service-offers";
import { globalCandidateSchema } from "../research/global-schema";
import { isCrmCountryCode } from "../crm/countries";
import { isPublicHttpUrl } from "../http/public-url";
import {
  permissionEvidenceSchema,
  evidenceReferenceSchema,
} from "./permission-evidence";

const id = z.string().min(1);
export const campaignTimestampSchema = z.union([
  z.date(),
  z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
]);
const date = campaignTimestampSchema;
const uuid = z.uuid();
const publicUrl = z
  .url()
  .refine(
    isPublicHttpUrl,
    "A public HTTP URL without credentials is required.",
  );
export const campaignVariantSchema = z.object({
  id,
  version: z.number().int().positive(),
  cta: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(/\?$/)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
});
export type CampaignVariant = z.infer<typeof campaignVariantSchema>;
export const campaignPolicySchema = z
  .object({
    version: z.number().int().positive(),
    accountConnectionId: uuid.nullable().default(null),
    status: z.enum(["paused", "approved", "revoked"]).default("paused"),
    approvedAt: date.nullable().default(null),
    effectiveAt: date.nullable().default(null),
    expiresAt: date.nullable().default(null),
    approverId: id.nullable().default(null),
    offer: id.nullable().default(null),
    commercialTerms: websiteServiceTermsSchema.optional(),
    capabilityEvidence: id.nullable().default(null),
    jurisdiction: id.nullable().default(null),
    provider: z.enum(["gmail", "resend"]).default("gmail"),
    permissionRequirement: z
      .enum(["consent", "requested_service"])
      .nullable()
      .default(null),
    recipientTimezone: z
      .string()
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      })
      .default("Europe/London"),
    sendWeekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length)
      .default([1, 2, 3, 4, 5]),
    windowStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default("09:00"),
    windowEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default("17:00"),
    dailyLimit: z
      .union([z.literal(25), z.literal(50), z.literal(100), z.literal(150)])
      .default(25),
    providerReserve: z.number().int().min(50).default(50),
    haltThresholds: z
      .object({
        hardBounces: z.number().int().nonnegative(),
        complaints: z.number().int().nonnegative(),
      })
      .nullable()
      .default(null),
    variants: z.array(campaignVariantSchema).default([]),
    cadenceFamily: z
      .enum(["review", "website", "facebook"])
      .nullable()
      .default(null),
  })
  .refine(
    (policy) => policy.windowEnd > policy.windowStart,
    "Sending windows cannot cross midnight.",
  );
export type CampaignPolicy = z.infer<typeof campaignPolicySchema>;
export const eligibilitySnapshotSchema = z.object({
  policyVersion: z.number().int().positive(),
  contactVersion: z.number().int().nonnegative().default(0),
  sourceVerifiedAt: date.nullable().default(null),
  contactVerifiedAt: date.nullable().default(null),
  permissionEvidence: id.nullable().default(null),
  permissionDetails: permissionEvidenceSchema.optional(),
  permissionBasis: z
    .enum(["consent", "requested_service"])
    .nullable()
    .default(null),
  permissionExpiresAt: date.nullable().default(null),
  permissionProvider: z.enum(["gmail", "resend"]).nullable().default(null),
  permissionJurisdiction: id.nullable().default(null),
  explicitOptIn: z.boolean().default(false),
  exclusion: z
    .enum(["none", "client", "suppressed", "ambiguous"])
    .default("none"),
  stopped: z.boolean().default(false),
  providerHealth: z.enum(["healthy", "unknown", "halted"]).default("unknown"),
});
export type EligibilitySnapshot = z.infer<typeof eligibilitySnapshotSchema>;
export const eligibilityDecisionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("eligible"), reason: z.literal("eligible") }),
  z.object({ status: z.literal("review"), reason: id }),
  z.object({ status: z.literal("blocked"), reason: id }),
]);
export type EligibilityDecision = z.infer<typeof eligibilityDecisionSchema>;
export const providerUsageSnapshotSchema = z.object({
  observedAt: date,
  rollingMessages: z.number().int().nonnegative(),
  rollingRecipients: z.number().int().nonnegative(),
  outstandingReservations: z.number().int().nonnegative(),
  accountMessageLimit: z.number().int().positive(),
  accountRecipientLimit: z.number().int().positive(),
  complete: z.boolean(),
  health: z.enum(["healthy", "unknown", "halted"]),
});
export type ProviderUsageSnapshot = z.infer<typeof providerUsageSnapshotSchema>;
export const sourceLeadInputSchema = z
  .object({
    requestId: uuid,
    sourceType: z.enum([
      "facebook_page",
      "facebook_group",
      "manual",
      "web",
      "google_maps",
      "referral",
      "inbound",
    ]),
    sourceUrl: publicUrl,
    businessName: id.max(200),
    countryCode: globalCandidateSchema.shape.business.shape.countryCode,
    corporateType: z.string().max(100).nullable(),
    registrationNumber: z.string().max(100).nullable(),
    firstName: z.string().max(100).nullable(),
    lastName: z.string().max(100).nullable(),
    email: z.email().nullable(),
    opportunity: z.string().max(2000),
    offer: z.string().max(200),
    observedAt: date,
  })
  .refine((input) => {
    if (!input.sourceType.startsWith("facebook_")) return true;
    const host = new URL(input.sourceUrl).hostname.toLowerCase();
    return host === "facebook.com" || host.endsWith(".facebook.com");
  }, "Facebook sources require a facebook.com URL.");
export type SourceLeadInput = z.infer<typeof sourceLeadInputSchema>;
export const campaignOutcomeInputSchema = z.object({
  membershipId: id,
  outcomeId: id,
  kind: z.enum(["meeting", "proposal", "payment"]),
  occurredAt: date,
  reviewed: z.boolean(),
  evidenceId: id,
  netClearedPence: z.number().int().nonnegative().nullable(),
});
export type CampaignOutcomeInput = z.infer<typeof campaignOutcomeInputSchema>;
const attestationSchema = z.strictObject({
  summary: z.string().trim().min(1).max(2000),
  reference: evidenceReferenceSchema,
  observedAt: date,
  expiresAt: date,
});
export const campaignPolicyDefinitionSchema = campaignPolicySchema.safeExtend({
  capabilityAttestation: attestationSchema,
  providerAttestation: attestationSchema.safeExtend({
    provider: z.enum(["gmail", "resend"]),
    jurisdiction: z
      .string()
      .trim()
      .length(2)
      .toUpperCase()
      .refine(isCrmCountryCode),
    confirmed: z.literal(true),
  }),
});
export type CampaignPolicyDefinition = z.infer<
  typeof campaignPolicyDefinitionSchema
>;
const mutation = { requestId: uuid };
const versionedCampaign = {
  ...mutation,
  campaignId: uuid,
  policyVersion: z.number().int().positive(),
};
export const campaignCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("create"),
    ...mutation,
    name: z.string().trim().min(1).max(200),
    policy: campaignPolicyDefinitionSchema,
  }),
  z.strictObject({
    type: z.literal("revise"),
    ...versionedCampaign,
    policy: campaignPolicyDefinitionSchema,
  }),
  z.strictObject({
    type: z.literal("enrol"),
    ...versionedCampaign,
    prospectId: uuid,
  }),
  z.strictObject({ type: z.literal("pause"), ...versionedCampaign }),
  z.strictObject({ type: z.literal("approve"), ...versionedCampaign }),
  z.strictObject({ type: z.literal("resume"), ...versionedCampaign }),
  z.strictObject({ type: z.literal("stop"), ...mutation, membershipId: uuid }),
  z.strictObject({
    type: z.literal("record_permission"),
    ...mutation,
    membershipId: uuid,
    evidenceId: uuid,
    basis: z.enum(["consent", "requested_service"]),
    provider: z.enum(["gmail", "resend"]),
    jurisdiction: z
      .string()
      .trim()
      .length(2)
      .toUpperCase()
      .refine(isCrmCountryCode),
    expiresAt: date,
    observedAt: date,
    explicitOptIn: z.boolean(),
    summary: z.string().trim().min(1).max(2000),
    reference: evidenceReferenceSchema,
    expectedProspectVersion: z.number().int().positive(),
    expectedContactVersion: z.number().int().positive(),
    proofRequestId: uuid.optional(),
    researchProofId: uuid.optional(),
    requestedService: z
      .strictObject({
        requestedAt: date,
        offerId: id,
        messageScope: z.literal("initial_and_two_followups"),
        attestsRecipientRequest: z.literal(true),
      })
      .optional(),
  }),
  z.strictObject({
    type: z.literal("record_reply"),
    ...mutation,
    membershipId: uuid,
    providerReplyId: id,
    kind: z.enum([
      "positive",
      "negative",
      "bot",
      "out_of_office",
      "opt_out",
      "unknown",
    ]),
    occurredAt: date,
  }),
  z.strictObject({
    type: z.literal("record_outcome"),
    ...mutation,
    outcome: campaignOutcomeInputSchema,
  }),
]);
export type CampaignCommand = z.infer<typeof campaignCommandSchema>;
export const campaignCommandResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    id: uuid,
    version: z.number().int().positive(),
    alreadyExisted: z.boolean(),
  }),
  z.object({ status: z.literal("error"), code: id, message: id }),
]);
export type CampaignCommandResult = z.infer<typeof campaignCommandResultSchema>;
export const campaignEventSchema = z.object({
  id,
  type: id,
  campaignId: id,
  membershipId: id.nullable(),
  occurredAt: date,
});
export type CampaignEvent = z.infer<typeof campaignEventSchema>;
export const campaignDueJobSchema = z.object({
  id,
  campaignId: id.nullable(),
  type: id,
  dueAt: date,
  idempotencyKey: id,
});
export type CampaignDueJob = z.infer<typeof campaignDueJobSchema>;
export const campaignRunSummarySchema = z.object({
  claimed: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});
export type CampaignRunSummary = z.infer<typeof campaignRunSummarySchema>;
const replySchema = z.object({
  id,
  kind: z.enum([
    "positive",
    "negative",
    "bot",
    "out_of_office",
    "opt_out",
    "unknown",
  ]),
  reviewed: z.boolean(),
  occurredAt: date,
  recordedAt: date,
});
const confirmationBasisSchema = z.enum([
  "gmail_fss_sent_observed",
  "resend_fss_delivery_observed",
]);
const reportMemberSchema = z.object({
  membershipId: id,
  businessId: id,
  market: id,
  offer: id,
  policyVersion: z.number().int().positive(),
  variantId: id,
  variantVersion: z.number().int().positive(),
  cta: id,
  comparisonFingerprint: id.nullable(),
  commercialTermsFingerprint: id.nullable(),
  confirmation: z.object({
    basis: confirmationBasisSchema,
    observedAt: date,
    possibleInvocationFrom: date.nullable(),
  }),
  replyCoverage: z.enum(["complete", "unknown", "censored"]),
  meetingObservation: z.enum(["complete", "unknown", "censored"]),
  paymentObservation: z.enum(["complete", "unknown", "censored"]),
  replies: z.array(replySchema),
  outcomes: z.array(campaignOutcomeInputSchema.extend({ recordedAt: date })),
});
export const campaignReportInputSchema = z.object({
  anchor: z.object({ basis: confirmationBasisSchema, observedAt: date }),
  cutoff: date,
  members: z.array(reportMemberSchema),
});
export type CampaignReportInput = z.infer<typeof campaignReportInputSchema>;
const groupSchema = z.object({
  market: id,
  offer: id,
  policyVersion: z.number(),
  variantId: id,
  variantVersion: z.number(),
  cta: id,
  comparisonFingerprint: id.nullable(),
  commercialTermsFingerprint: id.nullable(),
  basis: confirmationBasisSchema,
  mature: z.number(),
  censored: z.number(),
  later: z.number(),
  positiveReplies: z.number(),
  knownPositiveReplies: z.number(),
  preAnchorPositiveReplies: z.number(),
  unknownOriginPositiveReplies: z.number(),
  qualifiedMeetings: z.number(),
  unknownOriginMeetings: z.number(),
  meetingMature: z.number(),
  meetingUnknown: z.number(),
  meetingCensored: z.number(),
  paymentMature: z.number(),
  paymentUnknown: z.number(),
  paymentCensored: z.number(),
  paidConversions: z.number(),
  unknownOriginPayments: z.number(),
  missingReplies: z.number(),
  positiveReplyRate: z.number().nullable(),
  interval: z.tuple([z.number(), z.number()]).nullable(),
});
export const campaignReportSchema = z.object({
  anchor: z.object({ basis: confirmationBasisSchema, observedAt: date }),
  cutoff: date,
  groups: z.array(groupSchema),
  ambiguousEvidence: z.number().int().nonnegative(),
  winner: z.string().nullable(),
  winnerReason: z.enum([
    "clear_interval",
    "insufficient_evidence",
    "confounded",
    "unknown",
  ]),
});
export type CampaignReport = z.infer<typeof campaignReportSchema>;
export const campaignDashboardResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    campaigns: z.array(z.object({ id, policy: campaignPolicySchema })),
    summary: z.object({
      sent: z.number().int().nonnegative(),
      attempts: z.number().int().nonnegative(),
      review: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
      dailyCap: z.number().int().nonnegative(),
      shortfall: z.number().int().nonnegative(),
      haltReason: z.string().nullable(),
    }),
  }),
  z.object({ status: z.literal("error"), message: id }),
]);
export type CampaignDashboardResult = z.infer<
  typeof campaignDashboardResultSchema
>;
