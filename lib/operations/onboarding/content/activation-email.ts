import type { ApprovedEmail, WelcomeContent } from "../types";
import { emailFromParagraphs } from "./welcome-email";

export function activationEmail(
  to: string,
  content: WelcomeContent,
): ApprovedEmail {
  return emailFromParagraphs(
    to,
    "Your FSS client portal access",
    [
      "Hello,",
      "Your approved client portal access is ready. Activate it using this private link: {{portal_access_url}}",
      "Use your own email address to verify access. Your approved portal role determines the information and actions available to you.",
      "If you need help accessing the portal, reply to this email.",
      `${content.senderName}\n${content.organisationName}`,
    ],
    "",
    content,
    false,
    { label: "Activate portal access", url: "{{portal_access_url}}" },
  );
}
