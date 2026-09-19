import { z } from "zod";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import type { FssAdminContext } from "../auth/staff-types";
import { approvalBindingSchema, signingConsentSchema } from "./signing-types";
import {
  prepareAgreementSigning,
  approveAgreementSigning,
  cancelAgreementSigning,
  prepareStaffAgreementSigning,
  approveStaffAgreementSigning,
  cancelStaffAgreementSigning,
  signPortalAgreement,
  declinePortalAgreement,
} from "./signing-service";

const founderCommand = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("prepare"),
    agreementId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  }),
  approvalBindingSchema.extend({
    action: z.literal("approve"),
    expiresAt: z.iso.datetime(),
  }),
  z.strictObject({ action: z.literal("cancel"), approvalId: z.uuid() }),
]);
const portalCommand = z.discriminatedUnion("action", [
  signingConsentSchema.extend({ action: z.literal("sign") }),
  approvalBindingSchema.extend({ action: z.literal("decline") }),
]);
export { signingEnabled } from "./signing-worker";
export async function executeFounderSigningCommand(
  db: OperationsDb,
  founder: OperationsFounder,
  organisationId: string,
  raw: unknown,
  correlationId: string,
) {
  const { action, ...input } = founderCommand.parse(raw);
  if (action === "prepare")
    return prepareAgreementSigning(
      db,
      founder,
      organisationId,
      input,
      correlationId,
    );
  if (action === "approve")
    return approveAgreementSigning(
      db,
      founder,
      organisationId,
      input,
      correlationId,
    );
  return cancelAgreementSigning(
    db,
    founder,
    organisationId,
    input,
    correlationId,
  );
}
export async function executeStaffSigningCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
) {
  const { action, ...input } = founderCommand.parse(raw);
  if (action === "prepare")
    return prepareStaffAgreementSigning(
      db,
      admin,
      organisationId,
      input,
      correlationId,
    );
  if (action === "approve")
    return approveStaffAgreementSigning(
      db,
      admin,
      organisationId,
      input,
      correlationId,
    );
  return cancelStaffAgreementSigning(
    db,
    admin,
    organisationId,
    input,
    correlationId,
  );
}
export async function executePortalSigningCommand(
  db: OperationsDb,
  identity: VerifiedPortalIdentity,
  organisationId: string,
  raw: unknown,
  correlationId: string,
) {
  const { action, ...input } = portalCommand.parse(raw);
  if (action === "sign")
    return signPortalAgreement(
      db,
      identity,
      organisationId,
      input,
      correlationId,
    );
  return declinePortalAgreement(
    db,
    identity,
    organisationId,
    input,
    correlationId,
  );
}
