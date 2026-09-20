import { z } from "zod";
import { signingHash } from "./signing-render";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { OperationsFounder } from "../organisations/types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import { withAgreementTransaction } from "./repository";
import type {
  SigningApproval,
  SigningArtifact,
  SigningArtifactKind,
} from "./signing-types";

export async function loadSigningApprovals(
  tx: OperationsTransaction,
  organisationId: string | null,
  approvalId: string | null,
): Promise<SigningApproval[]> {
  const rows = await tx<SigningApproval[]>`
    select p.id,p.organisation_id as "organisationId",p.organisation_legal_name as "organisationLegalName",p.agreement_id as "agreementId",p.revision,p.agreement_version as "agreementVersion",
    p.snapshot->>'title' as title,p.snapshot as draft,p.source_hash as "sourceHash",p.approval_hash as "approvalHash",p.snapshot->'signatories' as "requiredSigners",
    case when p.status='approved' and p.expires_at<=clock_timestamp() and (select count(*) from operations.signing_signatures s where s.approval_id=p.id)<jsonb_array_length(p.snapshot->'signatories') then 'expired' else p.status end as status,
    to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt",
    to_char(p.approved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "approvedAt",
    to_char(p.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "expiresAt",
    to_char(p.completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "completedAt",
    coalesce((select jsonb_agg(jsonb_build_object('email',s.email,'typedName',s.typed_name,'userId',s.user_id::text,'signedAt',to_char(s.signed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by s.email) from operations.signing_signatures s where s.approval_id=p.id),'[]'::jsonb) as signatures
    from operations.signing_approvals p where (${organisationId}::uuid is null or p.organisation_id=${organisationId}::uuid) and (${approvalId}::uuid is null or p.id=${approvalId}::uuid) order by p.created_at desc,p.id limit 100`;
  return [...rows];
}
function validateLookup(organisationId: string, approvalId?: string): void {
  z.uuid().parse(organisationId);
  if (approvalId) z.uuid().parse(approvalId);
}
export async function listFounderSigning(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  correlationId: string,
): Promise<SigningApproval[]> {
  validateLookup(organisationId);
  z.uuid().parse(correlationId);
  return withAgreementTransaction(db, context, (tx) =>
    loadSigningApprovals(tx, organisationId, null),
  );
}
export async function listStaffSigning(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  correlationId: string,
): Promise<SigningApproval[]> {
  validateLookup(organisationId);
  z.uuid().parse(correlationId);
  return withFssAdminTransaction(db, admin, (tx) =>
    loadSigningApprovals(tx, organisationId, null),
  );
}

export type StaffSigningReadiness = {
  approvalId: string;
  organisationId: string;
  organisationName: string;
  title: string;
  status: "prepared" | "approved" | "expired";
};

/**
 * Cross-client signing work cannot be assembled from listStaffSigning without
 * one staff transaction per organisation. This queue keeps the Studio
 * overview inside a single staff-scoped read.
 */
export async function listStaffSigningReadiness(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<StaffSigningReadiness[]> {
  return withFssAdminTransaction(
    db,
    admin,
    (tx) =>
      tx<StaffSigningReadiness[]>`
        select
          p.id as "approvalId",
          p.organisation_id as "organisationId",
          o.display_name as "organisationName",
          coalesce(p.snapshot->>'title', 'Agreement') as title,
          case
            when p.status = 'approved'
              and p.expires_at <= clock_timestamp()
              and (select count(*) from operations.signing_signatures s
                where s.approval_id = p.id) < jsonb_array_length(p.snapshot->'signatories')
              then 'expired'
            else p.status
          end as status
        from operations.signing_approvals p
        join operations.organisations o on o.id = p.organisation_id
        where p.status in ('prepared', 'approved')
        order by
          case p.status when 'prepared' then 0 else 1 end,
          p.created_at asc,
          p.id
        limit 50
      `,
  );
}
export async function getFounderSigning(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  approvalId: string,
  correlationId: string,
): Promise<SigningApproval | null> {
  validateLookup(organisationId, approvalId);
  z.uuid().parse(correlationId);
  return withAgreementTransaction(
    db,
    context,
    async (tx) =>
      (await loadSigningApprovals(tx, organisationId, approvalId))[0] ?? null,
  );
}
export async function listPortalSigning(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<SigningApproval[]> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    (tx) => loadSigningApprovals(tx, organisationId, null),
  );
}
export async function getPortalSigning(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  approvalId: string,
  correlationId: string,
): Promise<SigningApproval | null> {
  z.uuid().parse(approvalId);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) =>
      (await loadSigningApprovals(tx, organisationId, approvalId))[0] ?? null,
  );
}
async function artifact(
  tx: OperationsTransaction,
  organisationId: string,
  approvalId: string,
  kind: SigningArtifactKind,
): Promise<SigningArtifact | null> {
  z.enum(["source", "signed", "audit"]).parse(kind);
  const [row] =
    kind === "source"
      ? await tx<
          { bytes: Buffer; hash: string }[]
        >`select source_pdf as bytes,source_hash as hash from operations.signing_approvals where organisation_id=${organisationId} and id=${approvalId}`
      : kind === "signed"
        ? await tx<
            { bytes: Buffer; hash: string }[]
          >`select signed_pdf as bytes,signed_hash as hash from operations.signing_artifacts where organisation_id=${organisationId} and approval_id=${approvalId}`
        : await tx<
            { bytes: Buffer; hash: string }[]
          >`select audit_bytes as bytes,audit_hash as hash from operations.signing_artifacts where organisation_id=${organisationId} and approval_id=${approvalId}`;
  if (row && signingHash(row.bytes) !== row.hash)
    throw new Error("Retained agreement artifact hash mismatch.");
  return row
    ? {
        ...row,
        contentType: kind === "audit" ? "application/json" : "application/pdf",
        filename: `agreement-${approvalId}-${kind}.${kind === "audit" ? "json" : "pdf"}`,
      }
    : null;
}
export async function downloadFounderSigningArtifact(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  approvalId: string,
  kind: SigningArtifactKind,
  correlationId: string,
): Promise<SigningArtifact | null> {
  validateLookup(organisationId, approvalId);
  z.uuid().parse(correlationId);
  return withAgreementTransaction(db, context, (tx) =>
    artifact(tx, organisationId, approvalId, kind),
  );
}
export async function downloadStaffSigningArtifact(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  approvalId: string,
  kind: SigningArtifactKind,
  correlationId: string,
): Promise<SigningArtifact | null> {
  validateLookup(organisationId, approvalId);
  z.uuid().parse(correlationId);
  return withFssAdminTransaction(db, admin, (tx) =>
    artifact(tx, organisationId, approvalId, kind),
  );
}
export async function downloadPortalSigningArtifact(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  approvalId: string,
  kind: SigningArtifactKind,
  correlationId: string,
): Promise<SigningArtifact | null> {
  z.uuid().parse(approvalId);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    (tx) => artifact(tx, organisationId, approvalId, kind),
  );
}
