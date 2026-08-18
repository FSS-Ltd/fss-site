import { createHash } from "node:crypto";
import type { ReactElement } from "react";
import { render } from "@react-email/render";

export type EmailTemplateKey =
  | "site-enquiry-thank-you"
  | "resource-delivery"
  | "client-delivery-thank-you"
  | "newsletter-welcome"
  | "newsletter-issue";

const ALLOWED_TEMPLATE_KEYS: readonly EmailTemplateKey[] = [
  "site-enquiry-thank-you",
  "resource-delivery",
  "client-delivery-thank-you",
  "newsletter-welcome",
  "newsletter-issue",
];

export type RenderEmailInput = {
  templateKey: EmailTemplateKey;
  element: ReactElement;
};

export type RenderedEmail = {
  templateKey: EmailTemplateKey;
  html: string;
  text: string;
  checksum: string;
};

function assertPlainTextParity(html: string, text: string): void {
  if (!text.trim()) {
    throw new TypeError("Email plain-text render is empty.");
  }
  if (/<[a-z][^>]*>/i.test(text)) {
    throw new TypeError("Email plain-text render still contains HTML markup.");
  }
  if (!/<html[\s>]/i.test(html)) {
    throw new TypeError("Email HTML render is incomplete.");
  }
}

export async function renderEmail(input: RenderEmailInput): Promise<RenderedEmail> {
  if (!ALLOWED_TEMPLATE_KEYS.includes(input.templateKey)) {
    throw new TypeError(`Email template "${input.templateKey}" is not allowlisted.`);
  }

  const html = await render(input.element);
  const text = await render(input.element, { plainText: true });

  assertPlainTextParity(html, text);

  const checksum = createHash("sha256").update(`\n${html}\n${text}`).digest("hex");

  return { templateKey: input.templateKey, html, text, checksum };
}
