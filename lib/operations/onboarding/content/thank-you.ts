import type { ApprovedEmail, WelcomeApprovalSnapshot } from "../types";
import { emailFromParagraphs } from "./welcome-email";
export function thankYouEmail(
  snapshot: WelcomeApprovalSnapshot,
  invoiceUrl: string,
  portalUrl: string,
): ApprovedEmail {
  return emailFromParagraphs(
    snapshot.recipient,
    snapshot.thankYou.subject,
    [
      `Hello ${snapshot.content.contactFirstName},`,
      snapshot.thankYou.intro,
      `Your first invoice is ready: ${invoiceUrl}. The invoice shows the amount and agreed due date.`,
      `Open your client portal here: ${portalUrl}. You can follow progress, submit requests, review work and manage payments in one place.`,
      "If you have not activated your approved portal access, use this private activation link: {{portal_access_url}}",
      `Our next step is ${snapshot.thankYou.nextStep}. ${snapshot.thankYou.requiredAction}`,
      `${snapshot.content.senderName}\n${snapshot.content.organisationName}`,
    ],
    "",
    snapshot.content,
    false,
    { label: "Open client workspace", url: portalUrl },
    "thank_you",
  );
}
