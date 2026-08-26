import { createFounderFirstEmailRevision } from "../sequences/edit-first-email";
import type {
  AssessmentSectionCandidate,
  FirstEmailCandidate,
  ResearchProspectCandidate,
  WebsiteEmailNarrative,
} from "../research/types";
import type { StoredProspectPreviewSnapshot } from "./types";

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

export function createDraftPreviewSnapshot(
  candidate: ResearchProspectCandidate,
): StoredProspectPreviewSnapshot {
  return {
    schemaVersion: "1.0",
    businessName: candidate.business.tradingName ?? candidate.business.legalName,
    sector: candidate.business.sector,
    locality: candidate.business.locality,
    businessGoal: candidate.assessment.businessGoal,
    primaryCta: candidate.assessment.primaryCta,
    homepageSections: candidate.assessment.homepageSections,
    conversionPlan: candidate.assessment.conversionPlan,
    trustSignals: candidate.assessment.trustSignals,
  };
}

export function renderPreviewFirstEmail(
  input: RenderPreviewFirstEmailInput,
): FirstEmailCandidate {
  const previewUrl = requirePreviewUrl(input.previewUrl);
  const improvements = input.narrative.improvements
    .map((improvement) => improvement.text)
    .join(". ");

  return createFounderFirstEmailRevision({
    subject: input.subject,
    paragraphs: [
      "I reviewed the website with one practical question: how does a new customer move from interest to a useful enquiry? I am sharing a private concept because the work on show deserves a clearer first step for people trying to reach you.",
      `One thing that came through clearly is ${input.narrative.openingStrength.text}. It gives visitors a useful starting point and shows there is a solid basis to build from.`,
      `A few parts of the current journey could be clearer: ${improvements}. Each point is about helping customers understand what to do next before they need to pick up the phone.`,
      "I didn’t want to just list off concerns, so I went ahead and built an example of what I believe will serve you and your customers or clients better:",
      `You can view the private concept here: ${previewUrl}`,
      input.conceptDisclaimer,
      input.optOutSentence,
      "If this feels relevant, I would be glad to talk through the thinking and hear where it should reflect the way your team works.",
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
