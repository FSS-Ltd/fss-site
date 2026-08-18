export type NewsletterPositionSection = {
  type: "position";
  heading: string;
  body: string[];
};

export type NewsletterPracticeSection = {
  type: "practice";
  heading: string;
  steps: string[];
};

export type NewsletterCaseNoteSection = {
  type: "case-note";
  heading: string;
  body: string[];
};

export type NewsletterCtaSection = {
  type: "cta";
  label: string;
  href: string;
};

export type NewsletterSection =
  | NewsletterPositionSection
  | NewsletterPracticeSection
  | NewsletterCaseNoteSection
  | NewsletterCtaSection;

export type NewsletterImageMetadata = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type NewsletterIssueContentInput = {
  subject: string;
  previewText: string;
  sections: NewsletterSection[];
  founderNote?: string;
  image?: NewsletterImageMetadata;
  unsubscribeUrl: string;
};

const MAX_SUBJECT_LENGTH = 150;
const MAX_PREVIEW_LENGTH = 200;

const BANNED_CLAIM_PATTERNS: readonly RegExp[] = [
  /\btestimonial(s)?\b/i,
  /\b\d+(\.\d+)?[- ]star(s)?\b/i,
  /\bguarantee(d|s)?\b/i,
  /\bproven results?\b/i,
  /\bbefore\s*(and|&)\s*after\b/i,
  /\b(increase[sd]?|boost(s|ed)?|grow(s|th)?)\s+(revenue|sales|conversions?)\s+by\s+\d+%/i,
];

export class NewsletterContentError extends Error {}

function requireNonEmpty(value: string, field: string, maxLength?: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new NewsletterContentError(`Newsletter issue requires ${field}.`);
  }
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new NewsletterContentError(`Newsletter issue ${field} exceeds ${maxLength} characters.`);
  }
  return trimmed;
}

function requireHttpsUrl(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NewsletterContentError(`Newsletter issue ${field} must be a valid URL.`);
  }
  if (url.protocol !== "https:") {
    throw new NewsletterContentError(`Newsletter issue ${field} must use HTTPS.`);
  }
  return url.href;
}

function assertNoBannedClaims(text: string, field: string): void {
  for (const pattern of BANNED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      throw new NewsletterContentError(`Newsletter issue ${field} contains a banned claim.`);
    }
  }
}

function validateSection(section: NewsletterSection, index: number): void {
  const label = `section ${index + 1}`;

  switch (section.type) {
    case "position":
    case "case-note": {
      const heading = requireNonEmpty(section.heading, `${label} heading`);
      assertNoBannedClaims(heading, `${label} heading`);
      if (section.body.length === 0) {
        throw new NewsletterContentError(`Newsletter issue ${label} has no body content.`);
      }
      section.body.forEach((paragraph, paragraphIndex) => {
        const text = requireNonEmpty(paragraph, `${label} paragraph ${paragraphIndex + 1}`);
        assertNoBannedClaims(text, `${label} paragraph ${paragraphIndex + 1}`);
      });
      break;
    }
    case "practice": {
      const heading = requireNonEmpty(section.heading, `${label} heading`);
      assertNoBannedClaims(heading, `${label} heading`);
      if (section.steps.length === 0) {
        throw new NewsletterContentError(`Newsletter issue ${label} has no steps.`);
      }
      section.steps.forEach((step, stepIndex) => {
        const text = requireNonEmpty(step, `${label} step ${stepIndex + 1}`);
        assertNoBannedClaims(text, `${label} step ${stepIndex + 1}`);
      });
      break;
    }
    case "cta": {
      const label2 = requireNonEmpty(section.label, `${label} call-to-action label`);
      assertNoBannedClaims(label2, `${label} call-to-action label`);
      requireHttpsUrl(section.href, `${label} call-to-action link`);
      break;
    }
  }
}

export function validateNewsletterIssueContent(
  input: NewsletterIssueContentInput,
): NewsletterIssueContentInput {
  requireNonEmpty(input.subject, "a subject", MAX_SUBJECT_LENGTH);
  requireNonEmpty(input.previewText, "preview text", MAX_PREVIEW_LENGTH);
  requireHttpsUrl(input.unsubscribeUrl, "unsubscribe URL");

  if (input.sections.length === 0) {
    throw new NewsletterContentError("Newsletter issue requires at least one section.");
  }

  const ctaSections = input.sections.filter((section) => section.type === "cta");
  if (ctaSections.length > 1) {
    throw new NewsletterContentError(
      "Newsletter issue must have at most one primary call to action.",
    );
  }

  input.sections.forEach((section, index) => validateSection(section, index));

  if (input.founderNote) {
    assertNoBannedClaims(input.founderNote, "founder note");
  }

  if (input.image) {
    requireNonEmpty(input.image.alt, "image alt text");
    if (
      !Number.isInteger(input.image.width) ||
      input.image.width <= 0 ||
      !Number.isInteger(input.image.height) ||
      input.image.height <= 0
    ) {
      throw new NewsletterContentError(
        "Newsletter issue image requires positive integer dimensions.",
      );
    }
    requireHttpsUrl(input.image.src, "image URL");
  }

  return input;
}
