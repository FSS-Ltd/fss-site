import type { z } from "zod";
import type { draftSchema, lineSchema, signatureSchema } from "./validation";
import type { Currency } from "../money";
import type { ServiceInstance } from "../services/types";
export type AgreementDraft = z.infer<typeof draftSchema>;
export type AgreementLine = z.infer<typeof lineSchema>;
export type SignatureEvidence = z.infer<typeof signatureSchema>;
export type AgreementRecord = {
  id: string;
  engagementId: string;
  version: number;
  revision: number;
  status: "draft" | "withdrawn" | "signed";
  archivedAt: string | null;
  hasSigningRequest?: boolean;
  draft: AgreementDraft;
  evidence: SignatureEvidence | null;
  evidenceProvenance?:
    | "manual_founder_confirmation"
    | "authenticated_portal_electronic_signature"
    | null;
  services: ServiceInstance[];
};
export type AgreementRegister = {
  organisationName: string;
  billingCurrency?: Currency;
  engagementIds: string[];
  engagementChoices?: Array<{ id: string; name: string }>;
  agreements: AgreementRecord[];
  nextCursor: string | null;
  moreEngagements: boolean;
};
export class AgreementConflict extends Error {
  constructor(
    message = "This agreement changed. Reload it before trying again.",
  ) {
    super(message);
    this.name = "AgreementConflict";
  }
}
