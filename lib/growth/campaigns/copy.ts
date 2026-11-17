import { offersEmailOptOut } from "../email/copy-policy";
import { escapeEmailHtmlText, isSafeEmailHtml } from "../email/html-policy";

function safe(value: string): string {
  if (
    !value.trim() ||
    value.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new TypeError("Invalid copy value");
  return value.trim();
}

export function buildCampaignSubject(input: {
  businessName: string;
  verifiedOwnerName: string | null;
}): string {
  const business = safe(input.businessName);
  return input.verifiedOwnerName
    ? `${safe(input.verifiedOwnerName)}, a question about ${business}`
    : `A question about ${business}`;
}

export function buildCampaignCopy(input: {
  businessName: string;
  verifiedOwnerName: string | null;
  verifiedObservation: string;
  offer: "review" | "website_preview";
  previewArtifactId: string | null;
  previewReviewed: boolean;
  cta: string;
}): {
  subject: string;
  text: string;
  html: string;
  wordCount: number;
  optOutSentence: string;
} {
  const business = safe(input.businessName);
  const observation = safe(input.verifiedObservation);
  const cta = safe(input.cta);
  if (!cta.endsWith("?")) throw new TypeError("CTA must be a question.");
  const intro = `I noticed ${observation} for ${business}.`;
  const offer =
    input.offer === "review"
      ? "I could prepare a short plan for requesting and responding to reviews if that would be useful."
      : input.previewReviewed && input.previewArtifactId
        ? `We prepared a reviewed preview for ${business}.`
        : `I could prepare a private one-page preview for ${business} if that would be useful.`;
  const optOutSentence = "Reply if you prefer not to receive further emails.";
  const text = `${intro}\n\n${offer}\n\n${cta}\n\n${optOutSentence}`;
  const html = text
    .split("\n\n")
    .map((part) => `<p>${escapeEmailHtmlText(part)}</p>`)
    .join("");
  if (!offersEmailOptOut(text) || !isSafeEmailHtml(html))
    throw new Error("Invalid email copy.");
  return {
    subject: buildCampaignSubject(input),
    text,
    html,
    wordCount: text.trim().split(/\s+/).length,
    optOutSentence,
  };
}

export function buildFacebookPost(input: {
  approved: boolean;
  availableSlots: number;
}): string {
  if (
    !input.approved ||
    !Number.isInteger(input.availableSlots) ||
    input.availableSlots < 1 ||
    input.availableSlots > 2
  )
    throw new Error("Approved scope and available slots are required.");
  return `We are offering ${input.availableSlots} local ${input.availableSlots === 1 ? "business" : "businesses"} a private one-page preview, with one revision each, in exchange for private feedback. Comment if interested and we will ask for your business name and current website. You retain ownership of your domain.`;
}
