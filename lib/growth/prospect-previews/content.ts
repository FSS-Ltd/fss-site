import { createFounderFirstEmailRevision } from "../sequences/edit-first-email";
import type {
  AssessmentSectionCandidate,
  FirstEmailCandidate,
  ResearchProspectCandidate,
  WebsiteEmailNarrative,
} from "../research/types";
import type { StoredProspectPreviewSnapshot } from "./types";

const MAX_OPENING_STRENGTH_WORDS = 28;
const MAX_IMPROVEMENT_WORDS = 16;

type RenderPreviewFirstEmailInput = {
  subject: string;
  narrative: WebsiteEmailNarrative;
  previewUrl: string;
  optOutSentence: string;
  conceptDisclaimer: string;
};

function requirePreviewUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Prospect preview URL must use HTTP or HTTPS.");
  }
  return url.toString();
}

function compactNarrativeText(value: string, maximumWords: number): string {
  const words = value.trim().split(/\s+/);
  if (words.length <= maximumWords) return value.trim();

  return `${words.slice(0, maximumWords).join(" ")}…`;
}

function compactEmailNarrative(
  narrative: WebsiteEmailNarrative,
): WebsiteEmailNarrative {
  return {
    openingStrength: {
      ...narrative.openingStrength,
      text: compactNarrativeText(
        narrative.openingStrength.text,
        MAX_OPENING_STRENGTH_WORDS,
      ),
    },
    improvements: narrative.improvements.map((improvement) => ({
      ...improvement,
      text: compactNarrativeText(improvement.text, MAX_IMPROVEMENT_WORDS),
    })),
  };
}

export function createDraftPreviewSnapshot(
  candidate: ResearchProspectCandidate,
): StoredProspectPreviewSnapshot {
  const snapshot = {
    businessName: candidate.business.tradingName ?? candidate.business.legalName,
    sector: candidate.business.sector,
    locality: candidate.business.locality,
    businessGoal: candidate.assessment.businessGoal,
    primaryCta: candidate.assessment.primaryCta,
    homepageSections: candidate.assessment.homepageSections,
    conversionPlan: candidate.assessment.conversionPlan,
    trustSignals: candidate.assessment.trustSignals,
  };

  if (candidate.assessment.experienceBrief !== undefined) {
    return {
      schemaVersion: "1.1",
      ...snapshot,
      experienceBrief: candidate.assessment.experienceBrief,
    };
  }

  return {
    schemaVersion: "1.0",
    ...snapshot,
  };
}

export function renderPreviewFirstEmail(
  input: RenderPreviewFirstEmailInput,
): FirstEmailCandidate {
  const previewUrl = requirePreviewUrl(input.previewUrl);
  // The approval email has a strict 220-word maximum. Source-backed
  // narratives may be far longer, so retain concise excerpts before rendering.
  const narrative = compactEmailNarrative(input.narrative);
  const improvements = narrative.improvements
    .map((improvement) => improvement.text)
    .join(". ");

  return createFounderFirstEmailRevision({
    subject: input.subject,
    paragraphs: [
      "I reviewed the website with one practical question: how can a new customer move from interest to a useful enquiry? I am sharing a private concept that gives people a clearer first step.",
      `One strength is ${narrative.openingStrength.text}. It gives visitors a useful starting point.`,
      `The journey could be clearer: ${improvements}. The aim is to make the next step easier.`,
      "I didn’t want to just list off concerns, so I went ahead and built an example of what I believe will serve you and your customers or clients better:",
      `You can view the private concept here: ${previewUrl}`,
      input.conceptDisclaimer,
      input.optOutSentence,
      "If this feels relevant, I would be glad to talk through it.",
    ],
    retained: {
      optOutSentence: input.optOutSentence,
      conceptDisclaimer: input.conceptDisclaimer,
    },
  });
}

export function deriveHistoricalEmailNarrative(input: {
  trustSignals: AssessmentSectionCandidate;
  conversionPlan: AssessmentSectionCandidate;
  firstPartyEvidenceUrl: string;
}): WebsiteEmailNarrative | null {
  if (input.conversionPlan.items.length < 2) return null;

  try {
    requirePreviewUrl(input.firstPartyEvidenceUrl);
  } catch {
    return null;
  }

  return {
    openingStrength: {
      text: input.trustSignals.summary,
      evidenceSourceUrl: input.firstPartyEvidenceUrl,
      kind: "first_party_service",
    },
    improvements: input.conversionPlan.items.slice(0, 3).map((text) => ({
      text,
      evidenceSourceUrl: input.firstPartyEvidenceUrl,
    })),
  };
}
