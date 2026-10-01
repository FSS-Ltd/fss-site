import type { ApprovedEmail } from "../types";
import type { WelcomePackId } from "../welcome-pack-contract";
import { getPacketEdition } from "../packet-editions";
import type { WelcomeEmailKind } from "../email-artwork";
import { escapeHtml, paragraphHtml } from "./email-html";
import {
  emailActionHtml,
  emailImageHtml,
  emailArtworkHtml,
  type EmailPrimaryAction,
} from "./email-fragments.node";

export function packetEmail(
  to: string,
  subject: string,
  paragraphs: string[],
  appendix: string,
  sender: {
    from: string;
    replyTo: string;
    organisationName?: string;
    edition?: WelcomePackId;
    emailArtworkVersion?: 1;
  },
  primaryAction?: EmailPrimaryAction,
  kind: WelcomeEmailKind = "welcome",
): ApprovedEmail {
  const brand = sender.organisationName ?? "Faithful Software Solutions";
  const edition = sender.edition ?? "website_build";
  const image =
    sender.emailArtworkVersion === 1
      ? emailArtworkHtml(edition, kind)
      : emailImageHtml(getPacketEdition(edition).coverImageId);
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#24322d;">${paragraphHtml(paragraph).replaceAll("\n", "<br/>")}</p>`,
    )
    .join("");
  // The packet's semantic alternative remains readable when mail clients block images.
  const guide = appendix.replace(/<img\b[^>]*>/g, "");
  const action = primaryAction
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 24px;"><tr><td>${emailActionHtml(primaryAction)}</td></tr></table>`
    : "";
  return {
    from: sender.from,
    replyTo: sender.replyTo,
    to,
    subject,
    text:
      paragraphs.join("\n\n") +
      (primaryAction ? `\n\n${primaryAction.label}: ${primaryAction.url}` : ""),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f2f5f4;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f2f5f4;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;font-family:Arial,Helvetica,sans-serif;background:#ffffff;"><tr><td style="padding:28px 24px;background:#10233f;border-bottom:4px solid #276b65;color:#ffffff;"><p style="margin:0 0 12px;font-size:12px;line-height:1.5;letter-spacing:1.2px;font-weight:bold;">FAITHFUL SOFTWARE SOLUTIONS</p><h1 style="margin:0;font-size:24px;line-height:1.35;color:#ffffff;">${escapeHtml(subject)}</h1></td></tr><tr><td style="padding:0;background:#10233f;">${image}</td></tr><tr><td style="padding:28px 24px;overflow-wrap:anywhere;">${body}${action}${guide}</td></tr><tr><td style="padding:20px 24px;background:#eaf1ee;color:#344c43;font-size:13px;line-height:1.6;"><p style="margin:0;">${escapeHtml(brand)}<br/>Questions about your project? Reply to this email.</p></td></tr></table></td></tr></table></body></html>`,
  };
}
