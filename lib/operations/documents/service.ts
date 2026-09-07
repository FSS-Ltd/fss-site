import { z } from "zod";
import { withAgreementTransaction } from "../agreements/repository";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import type { DeliveryCommandResult } from "../projects/service";
import { ProjectConflict } from "../projects/types";
import { documentCommandSchema } from "./validation";

export async function executeDocumentCommand(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<DeliveryCommandResult> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = documentCommandSchema.parse(raw);
  return withAgreementTransaction(db, context, async (tx) => {
    await tx`select set_config('operations.correlation_id',${correlationId},true)`;
    let version = 0;
    if (command.action !== "create") {
      const [current] = await tx<
        { version: number; revoked: boolean }[]
      >`select version,revoked_at is not null as revoked from operations.documents where organisation_id=${organisationId} and id=${command.documentId} for update`;
      if (
        !current ||
        current.revoked ||
        current.version !== command.expectedVersion
      )
        throw new ProjectConflict(
          "This document changed or is unavailable. Reload before trying again.",
        );
      version = current.version;
    }
    if (command.action === "revoke") {
      await tx`update operations.documents set revoked_at=now(),version=version+1,review_reference=${command.reviewReference} where organisation_id=${organisationId} and id=${command.documentId}`;
    } else {
      const m = command.metadata;
      const row = {
        project_id: m.projectId,
        milestone_id: m.milestoneId,
        title: m.title,
        kind: m.kind,
        visibility: m.visibility,
        expires_at: m.expiresAt,
        url: m.kind === "link" ? m.url : null,
        object_key:
          m.kind === "file"
            ? `operations/${organisationId}/${command.documentId}/${m.contentHash}`
            : null,
        filename: m.kind === "file" ? m.filename : null,
        mime_type: m.kind === "file" ? m.mimeType : null,
        size_bytes: m.kind === "file" ? m.sizeBytes : null,
        content_hash: m.kind === "file" ? m.contentHash : null,
        scan_status: m.kind === "file" ? m.scanStatus : "cleared",
        scan_content_hash: m.kind === "file" ? m.scanContentHash : null,
        scan_evidence: m.kind === "file" ? m.scanEvidence : null,
        review_reference: command.reviewReference,
        version: version + 1,
      };
      if (command.action === "create") {
        await tx`insert into operations.documents ${tx({ ...row, id: command.documentId, organisation_id: organisationId })}`;
      } else {
        await tx`update operations.documents set ${tx(row)} where organisation_id=${organisationId} and id=${command.documentId}`;
      }
    }
    return { id: command.documentId, version: version + 1 };
  });
}
