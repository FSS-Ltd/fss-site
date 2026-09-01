import { z } from "zod";

import { escapeEmailHtmlText, isSafeEmailHtml } from "../email/html-policy";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const EMAIL_TEXT_CONTROL_PATTERN = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const SEO_AUDIT_EMAIL_MIN_WORDS = 70;
const SEO_AUDIT_EMAIL_MAX_WORDS = 220;
const SEO_AUDIT_REPORT_URL_PLACEHOLDER =
  "https://faithfulsoftware.dev/audit.pdf";
const SEO_AUDIT_EMAIL_CLOSING =
  "If you would rather not hear from me, reply and I will close the loop.";

const publicUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2_000)
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === ""
    );
  }, "URL must be an HTTP(S) URL without credentials.");

const plainTextSchema = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine(
      (value) => !CONTROL_PATTERN.test(value),
      "Text contains control characters.",
    );

const emailTextSchema = z
  .string()
  .trim()
  .min(20)
  .max(20_000)
  .refine(
    (value) => !EMAIL_TEXT_CONTROL_PATTERN.test(value),
    "Email text contains unsupported control characters.",
  );

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

function buildSeoAuditEmailText(
  paragraphs: readonly string[],
  reportUrl: string,
): string {
  return [
    ...paragraphs,
    `I have put the full SEO and answer-engine audit here: ${reportUrl}`,
    SEO_AUDIT_EMAIL_CLOSING,
  ].join("\n\n");
}

export function hasValidSeoAuditEmailWordCount(
  paragraphs: readonly string[],
): boolean {
  const wordCount = countWords(
    buildSeoAuditEmailText(paragraphs, SEO_AUDIT_REPORT_URL_PLACEHOLDER),
  );
  return (
    wordCount >= SEO_AUDIT_EMAIL_MIN_WORDS &&
    wordCount <= SEO_AUDIT_EMAIL_MAX_WORDS
  );
}

const auditActionSchema = z
  .object({
    title: plainTextSchema(3, 120),
    instructions: plainTextSchema(20, 1_000),
  })
  .strict();

const auditFindingSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    severity: z.enum(["critical", "high", "medium", "low"]),
    title: plainTextSchema(6, 160),
    evidence: plainTextSchema(20, 1_200),
    whyItMatters: plainTextSchema(20, 1_000),
    actions: z.array(auditActionSchema).min(1).max(5),
  })
  .strict();

const auditSourceSchema = z
  .object({
    title: plainTextSchema(3, 180),
    url: publicUrlSchema,
    checkedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const seoAeoAuditSchema = z
  .object({
    executiveSummary: plainTextSchema(80, 2_000),
    scores: z
      .object({
        technicalSeo: z.number().int().min(0).max(100),
        onPageSeo: z.number().int().min(0).max(100),
        localSeo: z.number().int().min(0).max(100),
        answerEngineReadiness: z.number().int().min(0).max(100),
      })
      .strict(),
    strengths: z.array(plainTextSchema(15, 500)).min(1).max(5),
    findings: z.array(auditFindingSchema).min(4).max(12),
    answerEngineSummary: plainTextSchema(50, 1_200),
    sources: z.array(auditSourceSchema).min(1).max(20),
  })
  .strict();

export const seoAuditSubmissionSchema = z
  .object({
    auditId: z.string().regex(UUID_PATTERN),
    audit: seoAeoAuditSchema,
    email: z
      .object({
        subject: plainTextSchema(8, 160),
        paragraphs: z.array(plainTextSchema(20, 1_000)).min(2).max(4),
      })
      .strict()
      .refine(
        (email) => hasValidSeoAuditEmailWordCount(email.paragraphs),
        "SEO audit email must contain 70 to 220 words after application text is added.",
      ),
  })
  .strict();

export type SeoAeoAudit = z.infer<typeof seoAeoAuditSchema>;
export type SeoAuditSubmission = z.infer<typeof seoAuditSubmissionSchema>;

export type StoredSeoAuditEmail = {
  subject: string;
  html: string;
  text: string;
  wordCount: number;
};

export type StoredSeoAuditDraft = {
  schemaVersion: "1.0";
  reviewState: "draft" | "approved";
  version: number;
  reportUrl: string;
  reportSha256: string;
  audit: SeoAeoAudit;
  email: StoredSeoAuditEmail;
};

const storedSeoAuditDraftSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    reviewState: z.enum(["draft", "approved"]),
    version: z.number().int().positive(),
    reportUrl: publicUrlSchema,
    reportSha256: z.string().regex(/^[a-f0-9]{64}$/),
    audit: seoAeoAuditSchema,
    email: z
      .object({
        subject: plainTextSchema(8, 160),
        html: z.string().min(1).max(20_000),
        text: emailTextSchema,
        wordCount: z.number().int().positive().max(500),
      })
      .strict(),
  })
  .strict();

export function createStoredSeoAuditDraft(input: {
  submission: SeoAuditSubmission;
  reportUrl: string;
  reportSha256: string;
}): StoredSeoAuditDraft {
  const reportUrl = publicUrlSchema.parse(input.reportUrl);
  const reportSha256 = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.reportSha256);
  const paragraphs = [
    ...input.submission.email.paragraphs,
    `I have put the full SEO and answer-engine audit here: ${reportUrl}`,
    SEO_AUDIT_EMAIL_CLOSING,
  ];
  const text = buildSeoAuditEmailText(
    input.submission.email.paragraphs,
    reportUrl,
  );
  const wordCount = countWords(text);
  if (
    wordCount < SEO_AUDIT_EMAIL_MIN_WORDS ||
    wordCount > SEO_AUDIT_EMAIL_MAX_WORDS
  ) {
    throw new TypeError(
      "SEO audit email content must contain 70 to 220 words.",
    );
  }
  const html = paragraphs
    .map((paragraph) => {
      if (!paragraph.includes(reportUrl)) {
        return `<p>${escapeEmailHtmlText(paragraph)}</p>`;
      }
      const [before, after] = paragraph.split(reportUrl);
      return `<p>${escapeEmailHtmlText(before ?? "")}<a href="${escapeEmailHtmlText(reportUrl)}">Download the full audit (PDF)</a>${escapeEmailHtmlText(after ?? "")}</p>`;
    })
    .join("");
  if (!isSafeEmailHtml(html)) {
    throw new TypeError("SEO audit email HTML is invalid.");
  }

  return {
    schemaVersion: "1.0",
    reviewState: "draft",
    version: 1,
    reportUrl,
    reportSha256,
    audit: input.submission.audit,
    email: {
      subject: input.submission.email.subject,
      html,
      text,
      wordCount,
    },
  };
}

export function parseStoredSeoAuditDraft(value: unknown): StoredSeoAuditDraft {
  const parsed = storedSeoAuditDraftSchema.safeParse(value);
  if (!parsed.success || !isSafeEmailHtml(parsed.data.email.html)) {
    throw new TypeError("Stored SEO audit draft is invalid.");
  }
  if (countWords(parsed.data.email.text) !== parsed.data.email.wordCount) {
    throw new TypeError("Stored SEO audit draft word count is invalid.");
  }
  return parsed.data;
}
