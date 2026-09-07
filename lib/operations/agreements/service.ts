import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { activationSchema, validateActivation } from "../services/activation";
import {
  insertRevision,
  loadAgreement,
  withAgreementTransaction,
} from "./repository";
import { AgreementConflict, type AgreementRecord } from "./types";
import { draftSchema, signatureSchema } from "./validation";

const existing = {
  agreementId: z.uuid(),
  expectedVersion: z.number().int().positive(),
};
export const agreementCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("create"),
    engagementId: z.uuid(),
    draft: draftSchema,
  }),
  z.strictObject({
    action: z.literal("revise"),
    ...existing,
    draft: draftSchema,
  }),
  z.strictObject({
    action: z.literal("sign"),
    ...existing,
    evidence: signatureSchema,
  }),
  z.strictObject({
    action: z.literal("activate"),
    ...existing,
    lineNumber: z.number().int().min(1).max(30),
    evidence: activationSchema,
  }),
]);
export function assertEditable(
  record: Pick<AgreementRecord, "status" | "version">,
  expectedVersion: number,
): void {
  if (record.version !== expectedVersion) throw new AgreementConflict();
  if (record.status === "signed")
    throw new AgreementConflict(
      "Signed revisions are immutable. Create a separate agreement for new terms.",
    );
}
export async function executeAgreementCommand(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<AgreementRecord> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = agreementCommandSchema.parse(raw);
  return withAgreementTransaction(db, context, async (tx, founder) => {
    const [clock] = await tx<
      { today: string }[]
    >`select current_date::text as today`;
    let id: string;
    if (command.action === "create") {
      const [created] = await tx<
        { id: string }[]
      >`insert into operations.agreements(organisation_id,engagement_id,current_revision,created_by) values (${organisationId},${command.engagementId},1,${founder.actorId}) returning id`;
      id = created.id;
      await insertRevision(
        tx,
        organisationId,
        id,
        1,
        command.draft,
        founder.actorId,
        correlationId,
      );
    } else {
      id = command.agreementId;
      await tx`select id from operations.agreements where organisation_id=${organisationId} and id=${id} for update`;
      const record = await loadAgreement(tx, organisationId, id);
      if (!record)
        throw new AgreementConflict(
          "Agreement was not found in this organisation.",
        );
      if (record.version !== command.expectedVersion)
        throw new AgreementConflict();
      if (command.action === "revise") {
        assertEditable(record, command.expectedVersion);
        await insertRevision(
          tx,
          organisationId,
          id,
          record.revision + 1,
          command.draft,
          founder.actorId,
          correlationId,
        );
        await tx`update operations.agreements set current_revision=current_revision+1,version=version+1 where organisation_id=${organisationId} and id=${id}`;
      } else if (command.action === "sign") {
        assertEditable(record, command.expectedVersion);
        if (
          command.evidence.sourceHash !== record.draft.documentHash ||
          JSON.stringify(command.evidence.signatories) !==
            JSON.stringify(record.draft.signatories)
        )
          throw new AgreementConflict(
            "Signing evidence must match the source document and every required signatory.",
          );
        if (command.evidence.signedDate > clock.today)
          throw new AgreementConflict(
            "The recorded signing date cannot be in the future.",
          );
        await tx`insert into operations.signature_evidence(organisation_id,agreement_id,revision,evidence,created_by,correlation_id) values (${organisationId},${id},${record.revision},${tx.json(command.evidence)},${founder.actorId},${correlationId})`;
        await tx`update operations.agreements set status='signed',version=version+1 where organisation_id=${organisationId} and id=${id}`;
      } else {
        let evidence;
        try {
          evidence = validateActivation(
            record.draft,
            record.status === "signed",
            command.evidence,
            clock.today,
            command.lineNumber,
          );
        } catch (error) {
          throw new AgreementConflict(
            error instanceof Error
              ? error.message
              : "Activation conditions are not met.",
          );
        }
        if (record.services.some((s) => s.lineNumber === command.lineNumber))
          throw new AgreementConflict("This service is already active.");
        if (
          record.evidence &&
          evidence.effectiveDate < record.evidence.signedDate
        )
          throw new AgreementConflict(
            "The effective date cannot precede signing.",
          );
        const line = record.draft.lines[command.lineNumber - 1];
        await tx`insert into operations.service_instances(organisation_id,agreement_id,revision,line_number,effective_date,end_date,activation_evidence,created_by,correlation_id) values (${organisationId},${id},${record.revision},${command.lineNumber},${evidence.effectiveDate},${line.endDate},${tx.json(evidence)},${founder.actorId},${correlationId})`;
        await tx`update operations.agreements set version=version+1 where organisation_id=${organisationId} and id=${id}`;
      }
    }
    const result = await loadAgreement(tx, organisationId, id);
    if (!result)
      throw new Error("Agreement transaction did not produce a record.");
    return result;
  });
}
