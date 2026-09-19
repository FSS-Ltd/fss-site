import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsFounder } from "../organisations/types";
import {
  insertRevision,
  loadAgreement,
  withAgreementTransaction,
} from "./repository";
import { assertEditable } from "./service";
import { AgreementConflict } from "./types";
import { renderAgreementSource, signingHash } from "./signing-render";
import { loadSigningApprovals } from "./signing-repository";
import {
  approvalBindingSchema,
  signingConsentSchema,
  type SigningApproval,
} from "./signing-types";
export {
  listFounderSigning,
  getFounderSigning,
  listPortalSigning,
  getPortalSigning,
  downloadFounderSigningArtifact,
  downloadPortalSigningArtifact,
  downloadStaffSigningArtifact,
  listStaffSigning,
} from "./signing-repository";

// Convert expected database race/state rejections to the existing safe conflict.
export async function signingOperation<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["P0001", "P0002", "23505"].includes(String(error.code))
    )
      throw new AgreementConflict(
        "The signing request changed or is no longer available. Reload before trying again.",
      );
    throw error;
  }
}
const prepareSigningSchema = z.strictObject({
  agreementId: z.uuid(),
  expectedVersion: z.number().int().positive(),
});

async function prepareSigningInTransaction(
  tx: OperationsTransaction,
  actorId: string,
  organisationId: string,
  command: z.infer<typeof prepareSigningSchema>,
  correlationId: string,
): Promise<SigningApproval> {
  await tx`select id from operations.agreements where organisation_id=${organisationId} and id=${command.agreementId} for update`;
  const record = await loadAgreement(tx, organisationId, command.agreementId);
  if (!record) throw new AgreementConflict("Agreement was not found.");
  assertEditable(record, command.expectedVersion);
  const id = randomUUID();
  const [organisation] = await tx<
    { legalName: string }[]
  >`select legal_name as "legalName" from operations.organisations where id=${organisationId}`;
  const source = await renderAgreementSource(
    record.draft,
    organisation.legalName,
  );
  const draft = {
    ...record.draft,
    documentHash: signingHash(source),
    documentReference: `private:signing/${id}/source.pdf`,
  };
  await insertRevision(
    tx,
    organisationId,
    record.id,
    record.revision + 1,
    draft,
    actorId,
    correlationId,
  );
  await tx`update operations.agreements set current_revision=current_revision+1,version=version+1 where id=${record.id} and organisation_id=${organisationId}`;
  await tx`insert into operations.signing_approvals(id,organisation_id,organisation_legal_name,agreement_id,revision,agreement_version,snapshot,source_pdf,source_hash,approval_hash,created_by,correlation_id) values(${id},${organisationId},${organisation.legalName},${record.id},${record.revision + 1},${record.version + 1},${tx.json(draft)},${source},${draft.documentHash},${"0".repeat(64)},${actorId},${correlationId})`;
  return (await loadSigningApprovals(tx, organisationId, id))[0];
}

export async function prepareAgreementSigning(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = prepareSigningSchema.parse(raw);
  return signingOperation(() =>
    withAgreementTransaction(db, context, (tx, founder) =>
      prepareSigningInTransaction(
        tx,
        founder.actorId,
        organisationId,
        command,
        correlationId,
      ),
    ),
  );
}

export async function prepareStaffAgreementSigning(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = prepareSigningSchema.parse(raw);
  return signingOperation(() =>
    withFssAdminTransaction(db, admin, (tx) =>
      prepareSigningInTransaction(
        tx,
        admin.actorId,
        organisationId,
        command,
        correlationId,
      ),
    ),
  );
}
export async function approveAgreementSigning(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const c = approvalBindingSchema
    .extend({ expiresAt: z.iso.datetime() })
    .parse(raw);
  return signingOperation(() =>
    withAgreementTransaction(db, context, async (tx) => {
      await tx`select operations.approve_agreement_signing(${organisationId},${c.approvalId},${c.approvalHash},${c.expiresAt}::timestamptz,${correlationId})`;
      return (await loadSigningApprovals(tx, organisationId, c.approvalId))[0];
    }),
  );
}

export async function approveStaffAgreementSigning(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = approvalBindingSchema
    .extend({ expiresAt: z.iso.datetime() })
    .parse(raw);
  return signingOperation(() =>
    withFssAdminTransaction(db, admin, async (tx) => {
      await tx`select operations.approve_agreement_signing(${organisationId},${command.approvalId},${command.approvalHash},${command.expiresAt}::timestamptz,${correlationId})`;
      return (
        await loadSigningApprovals(tx, organisationId, command.approvalId)
      )[0];
    }),
  );
}
export async function cancelAgreementSigning(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const c = z.strictObject({ approvalId: z.uuid() }).parse(raw);
  return signingOperation(() =>
    withAgreementTransaction(db, context, async (tx) => {
      await tx`select operations.cancel_agreement_signing(${organisationId},${c.approvalId},${correlationId})`;
      return (await loadSigningApprovals(tx, organisationId, c.approvalId))[0];
    }),
  );
}

export async function cancelStaffAgreementSigning(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = z.strictObject({ approvalId: z.uuid() }).parse(raw);
  return signingOperation(() =>
    withFssAdminTransaction(db, admin, async (tx) => {
      await tx`select operations.cancel_agreement_signing(${organisationId},${command.approvalId},${correlationId})`;
      return (
        await loadSigningApprovals(tx, organisationId, command.approvalId)
      )[0];
    }),
  );
}
export async function signPortalAgreement(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  const c = signingConsentSchema.parse(raw);
  return signingOperation(() =>
    withPortalTransaction(
      db,
      identity,
      organisationId,
      correlationId,
      async (tx) => {
        if (!(await loadSigningApprovals(tx, organisationId, c.approvalId))[0])
          throw new PortalAccessDenied();
        await tx`select operations.record_agreement_signature(${c.approvalId},${c.approvalHash},${c.typedName},${c.authority},${c.consent},false)`;
        return (
          await loadSigningApprovals(tx, organisationId, c.approvalId)
        )[0];
      },
    ),
  );
}
export async function declinePortalAgreement(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<SigningApproval> {
  const c = approvalBindingSchema.parse(raw);
  return signingOperation(() =>
    withPortalTransaction(
      db,
      identity,
      organisationId,
      correlationId,
      async (tx) => {
        if (!(await loadSigningApprovals(tx, organisationId, c.approvalId))[0])
          throw new PortalAccessDenied();
        await tx`select operations.record_agreement_signature(${c.approvalId},${c.approvalHash},${""},false,false,true)`;
        return (
          await loadSigningApprovals(tx, organisationId, c.approvalId)
        )[0];
      },
    ),
  );
}
