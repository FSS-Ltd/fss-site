import type { ApprovedEmail, WelcomeContent } from "../types";
import { emailFromParagraphs } from "./welcome-email";
export function proposalEmail(
  to: string,
  content: WelcomeContent,
  scopeSummary: string,
  portalUrl: string,
): ApprovedEmail {
  return emailFromParagraphs(
    to,
    "Your FSS proposal is ready to review",
    [
      "Hello,",
      `Your proposal sets out ${scopeSummary}, the agreed fees and the delivery process. Review and sign it here: ${portalUrl}`,
      "If you have not activated your approved portal access, use this private activation link: {{portal_access_url}}",
      "Please check the scope, payment schedule and responsibilities. If anything needs changing, reply before signing so we can issue a revised proposal.",
      `${content.senderName}\n${content.organisationName}`,
    ],
    "",
    content,
  );
}
