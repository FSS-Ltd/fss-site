import { createFounderFirstEmailRevision } from "../growth/sequences/edit-first-email";
import { escapeEmailHtmlText } from "../growth/email/html-policy";
import type {
  FirstEmailCandidate,
  WebsiteEmailNarrative,
} from "../growth/research/types";
import { examplesForSector } from "./catalog";

type SectorExampleEmailInput = {
  subject: string;
  narrative: WebsiteEmailNarrative;
  sector: string;
  businessName?: string;
  siteUrl: string;
  previewUrl?: string;
  optOutSentence: string;
  conceptDisclaimer: string;
};

function httpUrl(value: string): URL {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new TypeError(
      "Example links must use an HTTP or HTTPS URL without credentials.",
    );
  return url;
}

function excerpt(value: string, maximum: number): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, maximum)
    .join(" ")
    .replace(/[.!?…]+$/u, "");
}

/** Links come from the local catalog, never from research-provided HTML. */
export function renderSectorExampleFirstEmail(
  input: SectorExampleEmailInput,
): FirstEmailCandidate {
  const base = httpUrl(input.siteUrl);
  const examples = examplesForSector(input.sector, input.businessName);
  const links = examples.length
    ? examples.map((example) => ({
        label: `${example.name} (${example.sector})`,
        url: new URL(`/examples/${example.slug}`, base).toString(),
      }))
    : [
        {
          label: "Example collection",
          url: new URL("/examples", base).toString(),
        },
      ];
  const concept = input.previewUrl
    ? httpUrl(input.previewUrl).toString()
    : null;
  const email = createFounderFirstEmailRevision({
    subject: input.subject,
    paragraphs: [
      "I work with local service firms that need their website to turn interest into a useful first conversation. A clear offer and an enquiry route that gathers the right details can make that next step easier for customers and the team.",
      `Your site already has a useful starting point: ${excerpt(input.narrative.openingStrength.text, 18)}.`,
      `The opportunity is to make the next step more useful: ${input.narrative.improvements
        .slice(0, 2)
        .map((item) => excerpt(item.text, 9))
        .join(". ")}.`,
      examples.length
        ? "I’ve built four interactive examples for your sector using fictional companies. Each takes a different design approach to clear services and a useful enquiry:"
        : "I’ve built interactive examples across other service sectors using fictional companies. They show how clear service information and guided enquiries can prepare a better call:",
      ...links.map((link) => `${link.label}: ${link.url}`),
      ...(concept
        ? [`Your existing private concept is also available: ${concept}`]
        : []),
      "These are demonstrations, not client results. The design and journey would be adapted to your business.",
      input.conceptDisclaimer,
      input.optOutSentence,
      "Would a short call to explore this be useful?",
    ],
    retained: {
      optOutSentence: input.optOutSentence,
      conceptDisclaimer: input.conceptDisclaimer,
    },
  });
  let html = email.html;
  for (const url of [
    ...links.map((link) => link.url),
    ...(concept ? [concept] : []),
  ]) {
    const safe = escapeEmailHtmlText(url);
    html = html.replace(safe, `<a href="${safe}">${safe}</a>`);
  }
  return { ...email, html };
}
