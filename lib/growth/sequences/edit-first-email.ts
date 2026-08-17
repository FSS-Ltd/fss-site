import {
  countTextOccurrences,
  escapeEmailHtmlText,
  isSafeEmailHtml,
} from "../email/html-policy";
import type { FirstEmailCandidate } from "../research/types";

const MIN_WORD_COUNT = 140;
const MAX_WORD_COUNT = 220;
const MAX_SUBJECT_LENGTH = 200;
const MAX_PARAGRAPHS = 20;
const MAX_PARAGRAPH_LENGTH = 2000;
const MAX_TEXT_LENGTH = 20_000;
const MAX_STANDARD_SENTENCE_LENGTH = 500;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

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
    throw new TypeError(`${label} is invalid.`);
  }
  return trimmed;
}

function requireParagraphs(values: readonly string[]): string[] {
  if (
    !Array.isArray(values) ||
    values.length < 1 ||
    values.length > MAX_PARAGRAPHS
  ) {
    throw new TypeError("First-email paragraphs are invalid.");
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
  if (!/opt[ -]?out|no further emails|not hear from me/i.test(optOutSentence)) {
    throw new TypeError("First-email opt-out sentence is invalid.");
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
  const { optOutSentence, conceptDisclaimer } = requireRetainedStandards(
    input.retained,
  );
  const text = paragraphs.join("\n\n");
  if (countTextOccurrences(text, optOutSentence) !== 1) {
    throw new TypeError(
      "First-email opt-out sentence must appear exactly once.",
    );
  }
  if (countTextOccurrences(text, conceptDisclaimer) !== 1) {
    throw new TypeError("First-email disclaimer must appear exactly once.");
  }

  const wordCount = text.split(/\s+/).length;
  if (
    text.length > MAX_TEXT_LENGTH ||
    wordCount < MIN_WORD_COUNT ||
    wordCount > MAX_WORD_COUNT
  ) {
    throw new TypeError("First-email content must contain 140 to 220 words.");
  }
  const html = paragraphs
    .map((paragraph) => `<p>${escapeEmailHtmlText(paragraph)}</p>`)
    .join("");
  if (!isSafeEmailHtml(html)) {
    throw new TypeError("First-email rendered HTML is invalid.");
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
