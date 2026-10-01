import type { ApprovedEmail, WelcomeContent } from "../types";
import type { WelcomePackId } from "../welcome-pack-contract";
import { escapeHtml, paragraphHtml } from "./email-html";
import type { EmailPrimaryAction } from "./email-fragments.node";
import { packetEmail } from "./packet-email";
import type { WelcomeEmailKind } from "../email-artwork";
export { escapeHtml } from "./email-html";

export function emailFromParagraphs(
  to: string,
  subject: string,
  paragraphs: string[],
  appendix = "",
  sender: {
    from: string;
    replyTo: string;
    rendererVersion?: 2;
    edition?: WelcomePackId;
    emailArtworkVersion?: 1;
    organisationName?: string;
  },
  branded = false,
  primaryAction?: EmailPrimaryAction,
  kind: WelcomeEmailKind = "welcome",
): ApprovedEmail {
  if (sender.rendererVersion === 2)
    return packetEmail(
      to,
      subject,
      paragraphs,
      appendix,
      sender,
      primaryAction,
      kind,
    );
  const brandHeader = branded
    ? `<header style="margin:-24px -24px 28px;padding:28px 24px;background:#10233f;color:#ffffff;border-bottom:4px solid #8ca998;"><p style="margin:0;font-size:12px;letter-spacing:1.4px;font-weight:700;">FAITHFUL SOFTWARE SOLUTIONS</p><p style="margin:10px 0 0;font-size:22px;line-height:1.3;font-weight:700;">A clear start to your project</p></header>`
    : "";
  return {
    from: sender.from,
    replyTo: sender.replyTo,
    to,
    subject,
    text: paragraphs.join("\n\n"),
    html: `<main style="box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#24322d;overflow-wrap:anywhere;">${brandHeader}${paragraphs.map((p) => `<p style="margin:0 0 20px;">${paragraphHtml(p)}</p>`).join("")}${appendix}</main>`,
  };
}
export function welcomeEmail(
  to: string,
  content: WelcomeContent,
  accessibleHtml: string,
): ApprovedEmail {
  const paragraphs = content.emailBody
    ? content.emailBody
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [
        `Hello ${content.contactFirstName},`,
        `Thank you for talking through ${content.primaryGoal} with us. Our proposed work will focus on ${content.outcomeSummary}.`,
        "The attached welcome guide explains the process, what we will need from you and how we will keep you informed. We will send the proposal separately for your review and signature. It will set out the services, fees and terms before work begins.",
        "If we have misunderstood a priority, reply and tell us. We will use your goals to guide the work and review progress with you.",
        `${content.senderName}\n${content.organisationName}`,
      ];
  const email = emailFromParagraphs(
    to,
    content.emailSubject ?? "Your next steps with FSS",
    paragraphs,
    content.rendererVersion === 2
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eaf1ee;"><tr><td style="padding:20px;color:#24322d;"><h2 style="margin:0 0 12px;font-size:20px;color:#10233f;">Your welcome packet</h2><p style="margin:0 0 12px;">Read the attached PDF before reviewing the proposal.</p><p style="margin:0 0 12px;">Inside: ${content.pages.map((page) => escapeHtml(page.title)).join(" · ")}.</p><p style="margin:0;">Next step: check the priorities and prepare the inputs in your checklist. Reply if a priority needs changing.</p></td></tr></table>`
      : accessibleHtml,
    content,
    true,
  );
  email.text +=
    content.rendererVersion === 2
      ? `\n\nYour welcome packet\nRead the attached PDF before reviewing the proposal.\nInside: ${content.pages.map((page) => page.title).join(" · ")}.\nNext step: check the priorities and prepare the inputs in your checklist. Reply if a priority needs changing.`
      : `\n\n${content.pages.map((page) => `${page.title}\n\n${page.paragraphs.join("\n\n")}`).join("\n\n")}`;
  return email;
}
