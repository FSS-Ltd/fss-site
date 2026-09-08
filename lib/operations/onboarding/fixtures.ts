import { prepareWelcome } from "./approval";
export function welcomeFixtureInput(recipient = "signer0@example.test") {
  return {
    recipient,
    invoice: {
      obligationKey: "installment:1",
      accountId: "acct_billingTest",
      livemode: false,
    },
    content: {
      contactFirstName: "Alex",
      primaryGoal: "reducing manual administration",
      outcomeSummary: "a reviewed request process",
      senderName: "Approved project owner",
      organisationName: "Faithful Software Solutions",
      from: "service@example.test",
      replyTo: "owner@example.test",
      pages: [
        {
          title: "Your priorities",
          paragraphs: [
            "Your priority is to reduce manual administration. We will review the agreed measures with your approver at each milestone.",
            "Your goals will guide the work. We will connect each agreed deliverable to the outcome it supports, make progress visible and raise changes early.",
          ],
        },
        {
          title: "The proposed work",
          paragraphs: [
            "The proposed scope covers a request board and client access. Data migration and additional integrations are excluded unless added to the proposal.",
            "The proposal governs the final services, fees and terms. Your approver will review the assumptions before signing.",
          ],
        },
        {
          title: "How delivery works",
          paragraphs: [
            "Review and sign the proposal, then review your invoice and portal access. Kickoff follows the agreed prerequisites, required assets and capacity confirmation.",
            "We will review each milestone before handover. Changes to scope follow the agreed review process.",
          ],
        },
        {
          title: "Working together",
          paragraphs: [
            "The approved project owner is your delivery contact. Your nominated approver reviews work through the request board. Updates are shared weekly during the agreed working hours.",
            "Use the approved secure asset handoff route for access details. Do not email passwords.",
          ],
        },
        {
          title: "Progress and next steps",
          paragraphs: [
            "Confirm your priorities, nominate your approver and gather the first agreed assets. Target dates are confirmed through the proposal and kickoff process.",
            "Raise questions through the request board or the agreed support address. Payment and service-start conditions remain governed by the agreement.",
          ],
        },
      ],
    },
    thankYou: {
      subject: "Your FSS agreement and next steps",
      intro: "Thank you for signing the agreement.",
      nextStep: "to confirm kickoff once the agreed prerequisites are met",
      requiredAction: "Please gather the agreed assets.",
    },
  };
}
export async function preparedWelcomeFixture(recipient?: string) {
  return prepareWelcome(welcomeFixtureInput(recipient));
}
