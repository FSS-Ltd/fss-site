import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import type { AgreementDraft } from "./types";
import {
  writeAgreementContent,
  writeExecutionRecord,
} from "./signing-pdf-content";
import { supportsSigningText, SIGNING_TEXT_ERROR } from "./signing-text";
import { AgreementConflict } from "./types";
import {
  SIGNING_ARTIFACT_LIMIT,
  SIGNING_CONSENT,
  type SigningApproval,
} from "./signing-types";

export function signingHash(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// One representation drives the PDF and accessible HTML. References and hashes
// describe retained bytes and are deliberately excluded from contractual content.
export function agreementContent(
  draft: AgreementDraft,
): Omit<AgreementDraft, "documentHash" | "documentReference"> {
  const {
    documentHash: _hash,
    documentReference: _reference,
    ...content
  } = draft;
  void _hash;
  void _reference;
  return content;
}

async function pdf(
  write: (document: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  const document = new PDFDocument({
    size: "A4",
    margin: 48,
  });
  const result = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    document.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > SIGNING_ARTIFACT_LIMIT) {
        document.destroy(
          new Error("Agreement PDF exceeds the private artifact limit."),
        );
        return;
      }
      chunks.push(chunk);
    });
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
  });
  write(document);
  document.end();
  return result;
}

export async function renderAgreementSource(
  draft: AgreementDraft,
  organisationLegalName: string,
): Promise<Buffer> {
  if (
    !supportsSigningText(agreementContent(draft)) ||
    !supportsSigningText(organisationLegalName)
  )
    throw new AgreementConflict(SIGNING_TEXT_ERROR);
  return pdf((document) =>
    writeAgreementContent(document, draft, organisationLegalName),
  );
}
export function signingAudit(approval: SigningApproval): Buffer {
  return Buffer.from(
    JSON.stringify(
      {
        format: "fss-inhouse-signing-v1",
        provenance: "authenticated_portal_electronic_signature",
        approvalId: approval.id,
        agreementId: approval.agreementId,
        organisationId: approval.organisationId,
        organisationLegalName: approval.organisationLegalName,
        revision: approval.revision,
        sourceHash: approval.sourceHash,
        approvalHash: approval.approvalHash,
        approvedAt: approval.approvedAt,
        requiredSigners: approval.requiredSigners,
        consent: SIGNING_CONSENT,
        signatures: approval.signatures,
      },
      null,
      2,
    ),
  );
}
export async function renderSignedAgreement(
  approval: SigningApproval,
  source: Buffer,
  audit: Buffer,
): Promise<Buffer> {
  if (signingHash(source) !== approval.sourceHash)
    throw new Error("Retained source hash mismatch.");
  return pdf((document) => {
    writeAgreementContent(
      document,
      approval.draft,
      approval.organisationLegalName,
    );
    writeExecutionRecord(document, approval);
    // Embed the exact bytes previewed and approved, as well as the readable copy.
    document.file(source, {
      name: "approved-source.pdf",
      type: "application/pdf",
      description: "Exact approved agreement",
    });
    document.file(audit, {
      name: "signature-audit.json",
      type: "application/json",
      description: "Signature audit evidence",
    });
  });
}
