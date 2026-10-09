import { formatMoney, type Currency } from "../money";
import type { AgreementDraft } from "./types";
import { totalLinePence } from "./validation";
import { SIGNING_CONSENT, type SigningApproval } from "./signing-types";
import {
  ensureSigningSpace,
  signingDetail,
  signingFieldRow,
  signingParagraph,
  signingSection,
  signingTitle,
  startSigningPdf,
} from "./signing-pdf-layout";

export function signingPounds(
  value: string,
  currency: Currency = "GBP",
): string {
  return formatMoney(value, currency);
}

function writeServiceLines(
  document: PDFKit.PDFDocument,
  draft: AgreementDraft,
): void {
  ensureSigningSpace(document, 190);
  signingSection(document, "06", "Service lines");
  for (const [index, line] of draft.lines.entries()) {
    ensureSigningSpace(document, 165);
    const heading = `${String(index + 1).padStart(2, "0")}  ${line.serviceCode}`;
    const dates = `${line.startDate} to ${line.endDate ?? "open-ended"}`;
    const dateFitsBesideHeading =
      document.font("Helvetica-Bold").fontSize(11).widthOfString(heading) <=
      250;
    const headingY = document.y;
    document
      .fillColor("#07182E")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(heading, 48, headingY, {
        width: dateFitsBesideHeading ? 250 : 499,
      });
    if (dateFitsBesideHeading)
      document
        .fillColor("#46566C")
        .font("Helvetica")
        .fontSize(9)
        .text(`SERVICE DATES  ${dates}`, 300, headingY + 1, {
          width: 247,
          align: "right",
        });
    else signingDetail(document, "Service dates", dates);
    document.y += 5;
    signingParagraph(document, line.description);
    signingFieldRow(document, [
      ["Quantity", String(line.quantity)],
      ["Unit price", signingPounds(line.unitPence, draft.currency)],
      ["Line total", signingPounds(totalLinePence(line), draft.currency)],
    ]);
    signingFieldRow(document, [
      ["Line discount", signingPounds(line.discountPence, draft.currency)],
      ["Line tax", signingPounds(line.taxPence, draft.currency)],
      [
        "Recurrence",
        line.recurrenceMonths === 0
          ? "One-off"
          : `Every ${line.recurrenceMonths} month(s)`,
      ],
    ]);
    document.y += 7;
  }
}

function writeRevenueShare(
  document: PDFKit.PDFDocument,
  draft: AgreementDraft,
): void {
  if (!draft.revenueShare) return;
  signingSection(document, "07", "Ongoing revenue share");
  signingFieldRow(document, [
    ["Percentage", `${(draft.revenueShare.percentageBps / 100).toFixed(2)}%`],
  ]);
  signingDetail(document, "Duration", draft.revenueShare.duration);
  signingDetail(document, "Revenue source", draft.revenueShare.revenueSource);
  signingDetail(
    document,
    "Calculation basis",
    draft.revenueShare.calculationBasis,
  );
  signingDetail(
    document,
    "Reporting requirements",
    draft.revenueShare.reportingRequirements,
  );
  signingDetail(document, "Payment terms", draft.revenueShare.paymentTerms);
  signingParagraph(
    document,
    "Revenue share replaces ongoing cash charges. One-off fees remain payable.",
  );
}

export function writeAgreementContent(
  document: PDFKit.PDFDocument,
  draft: AgreementDraft,
  organisationLegalName: string,
): void {
  startSigningPdf(document);
  signingTitle(document, "CLIENT SERVICE AGREEMENT", draft.title);
  signingFieldRow(document, [
    ["Client organisation", organisationLegalName],
    ["Service provider", "Faithful Software Solutions Ltd"],
  ]);

  for (const [index, title, value] of [
    ["01", "Scope", draft.scope],
    ["02", "Goals", draft.goals],
    ["03", "Terms", draft.terms],
    ["04", "Support", draft.support],
    ["05", "Responsibilities", draft.responsibilities],
  ]) {
    signingSection(document, index, title);
    signingParagraph(document, value);
  }

  writeServiceLines(document, draft);
  writeRevenueShare(document, draft);

  signingSection(
    document,
    draft.revenueShare ? "08" : "07",
    "Billing and commencement",
  );
  signingFieldRow(document, [
    ["Currency", draft.currency],
    [
      "Required deposit",
      signingPounds(draft.requiredDepositPence, draft.currency),
    ],
  ]);
  signingDetail(document, "Tax treatment", draft.taxTreatment);
  signingDetail(document, "Billing contact", draft.billingContact);
  signingFieldRow(document, [
    ["Assets required before activation", draft.assetsRequired ? "Yes" : "No"],
    ["Notice period", `${draft.noticeDays} days`],
  ]);
  signingFieldRow(document, [
    ["Minimum term", `${draft.minimumTermMonths} months`],
  ]);

  ensureSigningSpace(document, draft.installments.length ? 130 : 100);
  signingSection(document, draft.revenueShare ? "09" : "08", "Installments");
  if (!draft.installments.length)
    signingParagraph(document, "No one-off installments.");
  for (const installment of draft.installments)
    signingFieldRow(document, [
      ["Due date", installment.dueDate],
      ["Amount", signingPounds(installment.amountPence, draft.currency)],
    ]);

  ensureSigningSpace(document, 110);
  signingSection(
    document,
    draft.revenueShare ? "10" : "09",
    "Required signers",
  );
  for (const email of draft.signatories)
    signingFieldRow(document, [["Verified email", email]]);
}

export function writeExecutionRecord(
  document: PDFKit.PDFDocument,
  approval: SigningApproval,
): void {
  document.addPage();
  signingTitle(document, "ELECTRONIC EXECUTION", "Signing record");
  signingFieldRow(document, [
    ["Agreement", approval.title],
    ["Client organisation", approval.organisationLegalName],
  ]);
  signingFieldRow(document, [
    ["Revision", String(approval.revision)],
    ["Approved at (UTC)", approval.approvedAt ?? ""],
  ]);
  signingDetail(document, "Approval reference", approval.id);

  signingSection(document, "01", "Consent given by every signer");
  signingParagraph(document, SIGNING_CONSENT);

  signingSection(document, "02", "Authenticated signers");
  for (const [index, signature] of approval.signatures.entries()) {
    ensureSigningSpace(document, 126);
    signingFieldRow(document, [
      [`Signer ${index + 1}`, signature.typedName],
      ["Verified email", signature.email],
    ]);
    signingDetail(document, "Signed at (UTC)", signature.signedAt);
  }

  signingSection(document, "03", "Retained evidence");
  signingDetail(document, "Approved source SHA-256", approval.sourceHash);
  signingDetail(document, "Approval binding SHA-256", approval.approvalHash);
  signingParagraph(
    document,
    "The exact approved source PDF and server-recorded signature audit are embedded in this PDF. The source SHA-256 above identifies the bytes reviewed by every signer. This record documents ordinary electronic signatures; it is not a cryptographic PDF signature or witnessed execution.",
  );
}
