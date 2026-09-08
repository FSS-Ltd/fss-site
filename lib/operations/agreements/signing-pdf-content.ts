import type { AgreementDraft } from "./types";
import { totalLinePence } from "./validation";
import { SIGNING_CONSENT, type SigningApproval } from "./signing-types";

export function signingPounds(value: string): string {
  const amount = BigInt(value);
  return `£${(amount / BigInt(100)).toLocaleString("en-GB")}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}
function section(document: PDFKit.PDFDocument, title: string): void {
  if (document.y > document.page.height - 140) document.addPage();
  document
    .moveDown()
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(title)
    .moveDown(0.4)
    .font("Helvetica")
    .fontSize(10);
}
function term(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  document.text(`${label}: ${value}`, { paragraphGap: 6 });
}
export function writeAgreementContent(
  document: PDFKit.PDFDocument,
  draft: AgreementDraft,
  organisationLegalName: string,
): void {
  document.font("Helvetica-Bold").fontSize(21).text(draft.title).moveDown(0.5);
  document
    .font("Helvetica")
    .fontSize(11)
    .text(`Client organisation: ${organisationLegalName}`)
    .text("Service provider: Faithful Software Solutions Ltd");
  for (const [title, value] of [
    ["Scope", draft.scope],
    ["Goals", draft.goals],
    ["Terms", draft.terms],
    ["Support", draft.support],
    ["Responsibilities", draft.responsibilities],
  ]) {
    section(document, title);
    document.text(value, { paragraphGap: 6 });
  }
  section(document, "Service lines");
  for (const [index, line] of draft.lines.entries()) {
    if (document.y > document.page.height - 180) document.addPage();
    document
      .font("Helvetica-Bold")
      .text(`${index + 1}. ${line.serviceCode}`)
      .font("Helvetica")
      .text(line.description, { paragraphGap: 6 });
    term(document, "Quantity", String(line.quantity));
    term(document, "Unit price", signingPounds(line.unitPence));
    term(document, "Line discount", signingPounds(line.discountPence));
    term(document, "Line tax", signingPounds(line.taxPence));
    term(document, "Line total", signingPounds(totalLinePence(line)));
    term(
      document,
      "Recurrence",
      line.recurrenceMonths === 0
        ? "One-off"
        : `Every ${line.recurrenceMonths} month(s)`,
    );
    term(
      document,
      "Service dates",
      `${line.startDate} to ${line.endDate ?? "open-ended"}`,
    );
    document.moveDown(0.5);
  }
  section(document, "Billing and commencement");
  term(document, "Currency", draft.currency);
  term(document, "Tax treatment", draft.taxTreatment);
  term(document, "Billing contact", draft.billingContact);
  term(document, "Required deposit", signingPounds(draft.requiredDepositPence));
  term(
    document,
    "Assets required before activation",
    draft.assetsRequired ? "Yes" : "No",
  );
  term(document, "Notice period", `${draft.noticeDays} days`);
  term(document, "Minimum term", `${draft.minimumTermMonths} months`);
  section(document, "Installments");
  if (!draft.installments.length) document.text("No one-off installments.");
  for (const installment of draft.installments)
    term(document, installment.dueDate, signingPounds(installment.amountPence));
  section(document, "Required signers");
  for (const email of draft.signatories) document.text(email);
}
export function writeExecutionRecord(
  document: PDFKit.PDFDocument,
  approval: SigningApproval,
): void {
  document
    .addPage()
    .font("Helvetica-Bold")
    .fontSize(19)
    .text("Electronic execution record")
    .font("Helvetica")
    .fontSize(10)
    .moveDown();
  term(document, "Agreement", approval.title);
  term(document, "Client organisation", approval.organisationLegalName);
  term(document, "Revision", String(approval.revision));
  term(document, "Approval reference", approval.id);
  term(document, "Approved at (UTC)", approval.approvedAt ?? "");
  term(document, "Approved source SHA-256", approval.sourceHash);
  term(document, "Approval binding SHA-256", approval.approvalHash);
  section(document, "Consent given by every signer");
  document.text(SIGNING_CONSENT);
  section(document, "Authenticated signers");
  for (const signature of approval.signatures) {
    term(document, "Name", signature.typedName);
    term(document, "Verified email", signature.email);
    term(document, "Signed at (UTC)", signature.signedAt);
    document.moveDown(0.5);
  }
  section(document, "Retained evidence");
  document.text(
    "The exact approved source PDF and server-recorded signature audit are embedded in this PDF. The source SHA-256 above identifies the bytes reviewed by every signer. This record documents ordinary electronic signatures; it is not a cryptographic PDF signature or witnessed execution.",
  );
}
