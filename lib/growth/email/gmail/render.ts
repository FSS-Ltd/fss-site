import type { FirstEmailCandidate } from "../../research/types";
import {
  EMAIL_ASSET_FALLBACKS,
  type EmailAssetFallbackKey,
} from "../assets/fallbacks";
import {
  renderGmailMime,
  type GmailMessageInput,
  type RenderedGmailMessage,
} from "./mime";
import {
  countTextOccurrences,
  emailHtmlVisibleText,
  escapeEmailHtmlText,
  hasCanonicalEmailHtmlText,
  isSafeEmailHtml,
  removeCanonicalEmailHtmlText,
} from "../html-policy";

const MERGE_FIELDS = ["firstName", "businessName"] as const;
const MERGE_FIELD_PATTERN = /{{[^{}]*}}/g;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const MIN_ALT_TEXT_LENGTH = 20;
const MAX_ALT_TEXT_LENGTH = 1000;
const MAX_MERGE_VALUE_LENGTH = 200;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_DISPLAY_WIDTH = 560;
const MAX_IMAGE_BYTES = 180 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERCEL_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export type GmailMessageEnvelope = Omit<
  GmailMessageInput,
  "subject" | "html" | "text"
>;

type FirstEmailVisualBase = {
  conceptDisclaimer: string;
};

export type RenderableFirstEmailVisual =
  | (FirstEmailVisualBase & {
      kind: "approved";
      assetId: string;
      url: string;
      width: number;
      height: number;
      byteSize: number;
      altText: string;
    })
  | (FirstEmailVisualBase & {
      kind: "fallback";
      fallbackKey: EmailAssetFallbackKey;
      siteOrigin: string;
    });

export type FollowUpMergeField = (typeof MERGE_FIELDS)[number];

export type PublishedFollowUpSnapshot = {
  status: "published";
  htmlTemplate: string;
  textTemplate: string;
  requiredFields: readonly FollowUpMergeField[];
};

type FirstEmailContentInput = {
  snapshot: FirstEmailCandidate;
  visual: RenderableFirstEmailVisual;
};

type FirstEmailRenderInput = FirstEmailContentInput & {
  envelope: GmailMessageEnvelope;
};

type FollowUpRenderInput = {
  envelope: GmailMessageEnvelope;
  subject: string;
  snapshot: PublishedFollowUpSnapshot;
  mergeFields: Readonly<Record<FollowUpMergeField, string>>;
};

function requireApprovedSnapshot(snapshot: FirstEmailCandidate): void {
  const actualWordCount = snapshot.text.trim().split(/\s+/).length;
  if (
    !Number.isInteger(snapshot.wordCount) ||
    snapshot.wordCount < 140 ||
    snapshot.wordCount > 220 ||
    snapshot.wordCount !== actualWordCount
  ) {
    throw new TypeError("First-email snapshot word count is invalid.");
  }
  if (!isSafeEmailHtml(snapshot.html)) {
    throw new TypeError("First-email snapshot HTML is invalid.");
  }
  if (
    !snapshot.optOutSentence.trim() ||
    !/opt[ -]?out|no further emails|not hear from me/i.test(
      snapshot.optOutSentence,
    ) ||
    !hasCanonicalEmailHtmlText(snapshot.html, snapshot.optOutSentence) ||
    countTextOccurrences(
      emailHtmlVisibleText(snapshot.html),
      snapshot.optOutSentence,
    ) !== 1 ||
    countTextOccurrences(snapshot.text, snapshot.optOutSentence) !== 1
  ) {
    throw new TypeError("First-email snapshot opt-out is invalid.");
  }
  if (
    !snapshot.conceptDisclaimer.trim() ||
    !hasCanonicalEmailHtmlText(snapshot.html, snapshot.conceptDisclaimer) ||
    countTextOccurrences(
      emailHtmlVisibleText(snapshot.html),
      snapshot.conceptDisclaimer,
    ) !== 1 ||
    countTextOccurrences(snapshot.text, snapshot.conceptDisclaimer) !== 1
  ) {
    throw new TypeError("First-email snapshot disclaimer is invalid.");
  }
}

type ResolvedVisual = {
  url: string;
  altText: string;
  width: number;
  height: number;
  byteSize?: number;
};

function requireHttpsOrigin(value: string): URL {
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new TypeError("First-email fallback origin is invalid.");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== ""
  ) {
    throw new TypeError("First-email fallback origin is invalid.");
  }
  return origin;
}

function resolveVisual(visual: RenderableFirstEmailVisual): ResolvedVisual {
  if (visual.kind === "fallback") {
    const fallback = EMAIL_ASSET_FALLBACKS[visual.fallbackKey];
    if (!fallback) {
      throw new TypeError("First-email fallback is invalid.");
    }
    return {
      url: new URL(fallback.pathname, requireHttpsOrigin(visual.siteOrigin))
        .href,
      altText: fallback.altText,
      width: 1200,
      height: 630,
    };
  }
  if (visual.kind !== "approved") {
    throw new TypeError("First-email visual is not approved.");
  }
  if (!UUID_PATTERN.test(visual.assetId)) {
    throw new TypeError("First-email approved asset identity is invalid.");
  }

  let url: URL;
  try {
    url = new URL(visual.url);
  } catch {
    throw new TypeError("First-email image URL is invalid.");
  }
  if (
    visual.url.length > MAX_IMAGE_URL_LENGTH ||
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !url.hostname.endsWith(VERCEL_BLOB_HOST_SUFFIX) ||
    url.pathname !== `/growth-email-assets/${visual.assetId}.webp`
  ) {
    throw new TypeError("First-email approved asset URL is invalid.");
  }

  return {
    url: url.href,
    altText: visual.altText,
    width: visual.width,
    height: visual.height,
    byteSize: visual.byteSize,
  };
}

function requireVisual(
  visual: RenderableFirstEmailVisual,
  expectedDisclaimer: string,
): ResolvedVisual & { displayWidth: number; displayHeight: number } {
  if (visual.conceptDisclaimer !== expectedDisclaimer) {
    throw new TypeError("First-email visual disclaimer does not match.");
  }
  const resolved = resolveVisual(visual);

  const altText = resolved.altText.trim();
  if (
    altText.length < MIN_ALT_TEXT_LENGTH ||
    altText.length > MAX_ALT_TEXT_LENGTH ||
    CONTROL_PATTERN.test(altText)
  ) {
    throw new TypeError("First-email visual alt text is invalid.");
  }
  if (
    !Number.isInteger(resolved.width) ||
    !Number.isInteger(resolved.height) ||
    resolved.width < MAX_DISPLAY_WIDTH ||
    resolved.height < 1 ||
    (resolved.byteSize !== undefined &&
      (!Number.isInteger(resolved.byteSize) ||
        resolved.byteSize < 1 ||
        resolved.byteSize > MAX_IMAGE_BYTES)) ||
    resolved.width * 100 < resolved.height * 185 ||
    resolved.width * 100 > resolved.height * 195
  ) {
    throw new TypeError("First-email image dimensions are invalid.");
  }

  const displayWidth = Math.min(resolved.width, MAX_DISPLAY_WIDTH);
  const displayHeight = Math.round(
    (displayWidth * resolved.height) / resolved.width,
  );

  return { ...resolved, altText, displayWidth, displayHeight };
}

function renderFirstEmailHtml(
  snapshot: FirstEmailCandidate,
  visual: ReturnType<typeof requireVisual>,
): string {
  const escapedDisclaimer = escapeEmailHtmlText(snapshot.conceptDisclaimer);
  const htmlWithoutDisclaimer = removeCanonicalEmailHtmlText(
    snapshot.html,
    snapshot.conceptDisclaimer,
  );
  if (htmlWithoutDisclaimer === null) {
    throw new TypeError("First-email snapshot disclaimer is invalid.");
  }
  const bodyWithoutDisclaimer = htmlWithoutDisclaimer.replace(
    /<p>\s*<\/p>/i,
    "",
  );
  const image = `<p><img src="${escapeEmailHtmlText(visual.url)}" alt="${escapeEmailHtmlText(visual.altText)}" width="${visual.displayWidth}" height="${visual.displayHeight}"></p>`;
  const disclaimer = `<p>${escapedDisclaimer}</p>`;

  return `${image}${disclaimer}${bodyWithoutDisclaimer}`;
}

export type ApprovedFirstEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function renderApprovedFirstEmailContent(
  input: FirstEmailContentInput,
): ApprovedFirstEmailContent {
  requireApprovedSnapshot(input.snapshot);
  const visual = requireVisual(input.visual, input.snapshot.conceptDisclaimer);

  return {
    subject: input.snapshot.subject,
    text: input.snapshot.text,
    html: renderFirstEmailHtml(input.snapshot, visual),
  };
}

export function renderApprovedFirstEmail(
  input: FirstEmailRenderInput,
): RenderedGmailMessage {
  const content = renderApprovedFirstEmailContent(input);

  return renderGmailMime({
    ...input.envelope,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

function requireTemplate(snapshot: PublishedFollowUpSnapshot): void {
  if (snapshot.status !== "published") {
    throw new TypeError("Follow-up template is not published.");
  }
  if (!isSafeEmailHtml(snapshot.htmlTemplate)) {
    throw new TypeError("Follow-up template HTML is invalid.");
  }

  const placeholders = new Set([
    ...(snapshot.htmlTemplate.match(MERGE_FIELD_PATTERN) ?? []),
    ...(snapshot.textTemplate.match(MERGE_FIELD_PATTERN) ?? []),
  ]);
  const requiredFields = new Set(snapshot.requiredFields);
  const templatesWithoutAllowedPlaceholders = MERGE_FIELDS.reduce(
    (templates, field) => ({
      html: templates.html.replaceAll(`{{${field}}}`, ""),
      text: templates.text.replaceAll(`{{${field}}}`, ""),
    }),
    { html: snapshot.htmlTemplate, text: snapshot.textTemplate },
  );
  if (
    requiredFields.size !== snapshot.requiredFields.length ||
    requiredFields.size !== placeholders.size ||
    MERGE_FIELDS.some(
      (field) =>
        requiredFields.has(field) !== placeholders.has(`{{${field}}}`) ||
        (requiredFields.has(field) &&
          (!snapshot.htmlTemplate.includes(`{{${field}}}`) ||
            !snapshot.textTemplate.includes(`{{${field}}}`))),
    ) ||
    Array.from(placeholders).some(
      (placeholder) =>
        !MERGE_FIELDS.some((field) => placeholder === `{{${field}}}`),
    ) ||
    /{{|}}/.test(templatesWithoutAllowedPlaceholders.html) ||
    /{{|}}/.test(templatesWithoutAllowedPlaceholders.text) ||
    /{{{|}}}/.test(snapshot.htmlTemplate) ||
    /{{{|}}}/.test(snapshot.textTemplate)
  ) {
    throw new TypeError("Follow-up template merge fields are invalid.");
  }
}

function requireMergeValue(value: string): string {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_MERGE_VALUE_LENGTH ||
    CONTROL_PATTERN.test(trimmed)
  ) {
    throw new TypeError("Follow-up merge field is invalid.");
  }
  return trimmed;
}

function mergeTemplate(
  template: string,
  values: Readonly<Record<FollowUpMergeField, string>>,
  html: boolean,
): string {
  return MERGE_FIELDS.reduce((rendered, field) => {
    const value = requireMergeValue(values[field]);
    return rendered.replaceAll(
      `{{${field}}}`,
      html ? escapeEmailHtmlText(value) : value,
    );
  }, template);
}

export type RenderedFollowUpContent = {
  subject: string;
  html: string;
  text: string;
};

export function renderPublishedFollowUpContent(
  input: Omit<FollowUpRenderInput, "envelope">,
): RenderedFollowUpContent {
  requireTemplate(input.snapshot);

  return {
    subject: input.subject,
    html: mergeTemplate(input.snapshot.htmlTemplate, input.mergeFields, true),
    text: mergeTemplate(input.snapshot.textTemplate, input.mergeFields, false),
  };
}

export function renderPublishedFollowUp(
  input: FollowUpRenderInput,
): RenderedGmailMessage {
  if (!input.envelope.thread) {
    throw new TypeError("A follow-up must remain in the original thread.");
  }
  const content = renderPublishedFollowUpContent(input);

  return renderGmailMime({
    ...input.envelope,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}
