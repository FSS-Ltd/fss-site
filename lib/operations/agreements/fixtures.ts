import type { AgreementDraft } from "./types";
export function agreementDraft(): AgreementDraft {
  return {
    title: "Website delivery",
    scope: "Agreed website scope",
    goals: "Launch the agreed site",
    terms: "Approved contract terms",
    support: "Support by agreement",
    responsibilities: "Supply approved assets",
    billingContact: "billing@example.test",
    signatories: ["client@example.test", "founder@example.test"],
    documentHash: "b".repeat(64),
    documentReference: "private:agreements/source-v1.pdf",
    currency: "GBP" as const,
    taxTreatment: "Accountant-reviewed contractual treatment",
    noticeDays: 30,
    minimumTermMonths: 0,
    requiredDepositPence: "6000",
    assetsRequired: true,
    lines: [
      {
        serviceCode: "website",
        description: "Website delivery",
        quantity: 1,
        unitPence: "10000",
        discountPence: "0",
        taxPence: "2000",
        recurrenceMonths: 0,
        startDate: "2026-10-01",
        endDate: null as string | null,
      },
    ],
    installments: [
      { dueDate: "2026-10-01", amountPence: "6000" },
      { dueDate: "2026-11-01", amountPence: "6000" },
    ],
  };
}
export function signatureEvidence() {
  return {
    confirmed: true as const,
    sourceHash: "b".repeat(64),
    signedDocumentHash: "c".repeat(64),
    documentReference: "private:agreements/signed-v1.pdf",
    certificateReference: "private:agreements/certificate-v1.pdf",
    signatories: ["client@example.test", "founder@example.test"],
    signedDate: "2026-09-06",
  };
}
