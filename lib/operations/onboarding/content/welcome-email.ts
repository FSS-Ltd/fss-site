import type { ApprovedEmail, WelcomeContent } from "../types";
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function paragraphHtml(paragraph: string): string {
  return paragraph
    .split(/(https:\/\/[^\s]+|\{\{portal_access_url\}\})/g)
    .map((part, index) => {
      if (index % 2 === 0) return escapeHtml(part);
      const url = part.replace(/[.,;:!?]+$/, "");
      return `<a href="${escapeHtml(url)}" style="color:#17372d;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(url)}</a>${escapeHtml(part.slice(url.length))}`;
    })
    .join("");
}

export function emailFromParagraphs(
  to: string,
  subject: string,
  paragraphs: string[],
  appendix = "",
  sender: { from: string; replyTo: string },
  branded = false,
): ApprovedEmail {
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
    accessibleHtml,
    content,
    true,
  );
  email.text += `\n\n${content.pages.map((page) => `${page.title}\n\n${page.paragraphs.join("\n\n")}`).join("\n\n")}`;
  return email;
}
