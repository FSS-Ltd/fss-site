import { z } from "zod";
import { supportsSigningText, SIGNING_TEXT_ERROR } from "./signing-text";
import type { AgreementDraft } from "./types";

export const approvalBindingSchema = z.strictObject({
  approvalId: z.uuid(),
  approvalHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const signingConsentSchema = approvalBindingSchema.extend({
  typedName: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[^\x00-\x1f\x7f]+$/)
    .refine(supportsSigningText, SIGNING_TEXT_ERROR),
  authority: z.literal(true),
  consent: z.literal(true),
});
export const SIGNING_CONSENT =
  "I agree to this exact agreement and consent to signing it electronically. I confirm that I have authority to bind the named organisation.";
export const SIGNING_ARTIFACT_LIMIT = 1024 * 1024;
export type SigningArtifactKind = "source" | "signed" | "audit";
export type SigningSignature = {
  email: string;
  typedName: string;
  signedAt: string;
  userId: string;
};
export type SigningApproval = {
  id: string;
  organisationId: string;
  organisationLegalName: string;
  agreementId: string;
  revision: number;
  agreementVersion: number;
  title: string;
  draft: AgreementDraft;
  sourceHash: string;
  approvalHash: string;
  requiredSigners: string[];
  status:
    | "prepared"
    | "approved"
    | "completed"
    | "declined"
    | "cancelled"
    | "superseded"
    | "expired";
  createdAt: string;
  approvedAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  completionAttempts: number;
  completionFailureCode: "document_processing_failed" | null;
  signatures: SigningSignature[];
};
export type SigningArtifact = {
  bytes: Buffer;
  hash: string;
  contentType: "application/pdf" | "application/json";
  filename: string;
};
