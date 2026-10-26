import {
  countTextOccurrences,
  escapeEmailHtmlText,
  isSafeEmailHtml,
} from "../email/html-policy";
import type { FirstEmailCandidate } from "../research/types";
import {
  findConceptDisclosure,
  findEmailOptOut,
  offersEmailOptOut,
} from "../email/copy-policy";

const MAX_WORD_COUNT = 2000;
const MAX_SUBJECT_LENGTH = 200;
const MAX_PARAGRAPHS = 20;
const MAX_PARAGRAPH_LENGTH = 2000;
const MAX_TEXT_LENGTH = 20_000;
const MAX_STANDARD_SENTENCE_LENGTH = 500;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

export class InvalidFirstEmailRevisionContentError extends TypeError {}

export type FounderFirstEmailRevisionInput = {
  subject: string;
  paragraphs: readonly string[];
  retained: Pick<FirstEmailCandidate, "optOutSentence" | "conceptDisclaimer">;
};

function requireSingleLineText(
  value: string,
  label: string,
  maxLength: number,
): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || CONTROL_PATTERN.test(trimmed)) {
    throw new InvalidFirstEmailRevisionContentError(`${label} is invalid.`);
  }
  return trimmed;
}

function requireParagraphs(values: readonly string[]): string[] {
  if (
    !Array.isArray(values) ||
    values.length < 1 ||
    values.length > MAX_PARAGRAPHS
  ) {
    throw new InvalidFirstEmailRevisionContentError(
      "First-email paragraphs are invalid.",
    );
  }
  return values.map((value) =>
    requireSingleLineText(value, "First-email paragraph", MAX_PARAGRAPH_LENGTH),
  );
}

function requireRetainedStandards(
  retained: FounderFirstEmailRevisionInput["retained"],
): { optOutSentence: string; conceptDisclaimer: string } {
  const optOutSentence = requireSingleLineText(
    retained.optOutSentence,
    "First-email opt-out sentence",
    MAX_STANDARD_SENTENCE_LENGTH,
  );
  if (!offersEmailOptOut(optOutSentence)) {
    throw new InvalidFirstEmailRevisionContentError(
      "First-email opt-out sentence is invalid.",
    );
  }
  const conceptDisclaimer = requireSingleLineText(
    retained.conceptDisclaimer,
    "First-email concept disclaimer",
    MAX_STANDARD_SENTENCE_LENGTH,
  );
  return { optOutSentence, conceptDisclaimer };
}

export function createFounderFirstEmailRevision(
  input: FounderFirstEmailRevisionInput,
): FirstEmailCandidate {
  const subject = requireSingleLineText(
    input.subject,
    "First-email subject",
    MAX_SUBJECT_LENGTH,
  );
  const paragraphs = requireParagraphs(input.paragraphs);
  requireRetainedStandards(input.retained);
  const text = paragraphs.join("\n\n");
  const optOutSentence = text.includes(input.retained.optOutSentence)
    ? input.retained.optOutSentence
    : findEmailOptOut(text);
  const conceptDisclaimer = text.includes(input.retained.conceptDisclaimer)
    ? input.retained.conceptDisclaimer
    : findConceptDisclosure(text);
  if (!optOutSentence)
    throw new InvalidFirstEmailRevisionContentError(
      "Include a clear email opt-out.",
    );
  if (!conceptDisclaimer)
    throw new InvalidFirstEmailRevisionContentError(
      "Include a concept disclaimer for the visual.",
    );
  if (countTextOccurrences(text, optOutSentence) !== 1) {
    throw new InvalidFirstEmailRevisionContentError(
      "First-email opt-out sentence must appear exactly once.",
    );
  }
  if (countTextOccurrences(text, conceptDisclaimer) !== 1) {
    throw new InvalidFirstEmailRevisionContentError(
      "First-email disclaimer must appear exactly once.",
    );
  }

  const wordCount = text.split(/\s+/).length;
  if (text.length > MAX_TEXT_LENGTH || wordCount > MAX_WORD_COUNT) {
    throw new InvalidFirstEmailRevisionContentError(
      "First-email content must contain no more than 2000 words.",
    );
  }
  const html = paragraphs
    .map((paragraph) => `<p>${escapeEmailHtmlText(paragraph)}</p>`)
    .join("");
  if (!isSafeEmailHtml(html)) {
    throw new InvalidFirstEmailRevisionContentError(
      "First-email rendered HTML is invalid.",
    );
  }

  return {
    subject,
    html,
    text,
    wordCount,
    optOutSentence,
    conceptDisclaimer,
  };
}
