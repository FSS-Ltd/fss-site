import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { runAgreementCommand } from "./service";
import type { AgreementRecord } from "./types";
import {
  agreementBuilderDraftContentSchema,
  agreementBuilderDraftCommandSchema,
  agreementBuilderStepSchema,
  completeAgreementBuilderDraftContentSchema,
  type AgreementBuilderDraftContent,
  type AgreementBuilderStep,
  type FinaliseAgreementBuilderDraftCommand,
  type SaveAgreementBuilderDraftCommand,
} from "./builder-draft-schema";
import { draftSchema } from "./validation";

export type AgreementBuilderDraft = Readonly<{
  content: AgreementBuilderDraftContent;
  createdAt: string;
  engagementId: string | null;
  id: string;
  organisationId: string;
  step: AgreementBuilderStep;
  updatedAt: string;
  version: number;
}>;

type AgreementBuilderDraftRow = Readonly<{
  content: unknown;
  createdAt: string;
  engagementId: string | null;
  id: string;
  organisationId: string;
  step: string;
  updatedAt: string;
  version: number;
}>;

const agreementBuilderDraftSchema = z
  .strictObject({
    content: agreementBuilderDraftContentSchema,
    createdAt: z.string().min(1),
    engagementId: z.uuid().nullable(),
    id: z.uuid(),
    organisationId: z.uuid(),
    step: agreementBuilderStepSchema,
    updatedAt: z.string().min(1),
    version: z.number().int().positive(),
  })
  .superRefine((draft, context) => {
    if ((draft.content.engagementId ?? null) !== draft.engagementId) {
      context.addIssue({
        code: "custom",
        message: "Agreement builder draft engagement is inconsistent.",
        path: ["engagementId"],
      });
    }
  });

export class AgreementBuilderDraftConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgreementBuilderDraftConflict";
  }
}

export class AgreementBuilderDraftValidationError extends Error {
  constructor() {
    super("Check the agreement details before finalising.");
    this.name = "AgreementBuilderDraftValidationError";
  }
}

function toAgreementDraft(
  content: AgreementBuilderDraftContent,
): { draft: AgreementRecord["draft"]; engagementId: string } {
  const parsed = completeAgreementBuilderDraftContentSchema.safeParse(content);
  if (!parsed.success) throw new AgreementBuilderDraftValidationError();

  const draft = draftSchema.safeParse({
    ...parsed.data.agreement,
    documentHash: "0".repeat(64),
    documentReference: "private:agreement-drafts/unbound.pdf",
  });
  if (!draft.success) throw new AgreementBuilderDraftValidationError();

  return { draft: draft.data, engagementId: parsed.data.engagementId };
}

function draftConflict(error: unknown): never {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "40001")
      throw new AgreementBuilderDraftConflict(
        "This agreement draft changed. Reload it before saving again.",
      );
    if (["23503", "P0001", "P0002"].includes(code))
      throw new AgreementBuilderDraftConflict(
        "This agreement draft is no longer available for this client.",
      );
  }
  throw error;
}

async function saveDraft(
  tx: OperationsTransaction,
  organisationId: string,
  command: SaveAgreementBuilderDraftCommand,
): Promise<AgreementBuilderDraft> {
  const [saved] = await tx<AgreementBuilderDraftRow[]>`
    select id,
      organisation_id as "organisationId",
      engagement_id as "engagementId",
      step,
      content,
      version,
      created_at::text as "createdAt",
      updated_at::text as "updatedAt"
    from operations.save_agreement_builder_draft(
      ${command.draftId},
      ${organisationId},
      ${command.step},
      ${tx.json(command.content)},
      ${command.expectedVersion}
    )
  `;
  if (!saved) throw new Error("Agreement builder draft was not saved.");
  return agreementBuilderDraftSchema.parse(saved);
}

async function finaliseDraft(
  tx: OperationsTransaction,
  actorId: string,
  organisationId: string,
  command: FinaliseAgreementBuilderDraftCommand,
  correlationId: string,
): Promise<AgreementRecord> {
  const [stored] = await tx<AgreementBuilderDraftRow[]>`
    select id,
      organisation_id as "organisationId",
      engagement_id as "engagementId",
      step,
      content,
      version,
      created_at::text as "createdAt",
      updated_at::text as "updatedAt"
    from operations.load_agreement_builder_draft(
      ${command.draftId},
      ${organisationId},
      ${command.expectedVersion}
    )
  `;
  if (!stored)
    throw new AgreementBuilderDraftConflict(
      "This agreement draft is no longer available for this client.",
    );

  const builderDraft = agreementBuilderDraftSchema.parse(stored);
  const complete = toAgreementDraft(builderDraft.content);
  const [linkedEngagement] = await tx<Array<{ engagementId: string }>>`
    select engagement_id as "engagementId"
    from operations.engagement_links
    where organisation_id = ${organisationId}
      and engagement_id = ${complete.engagementId}
    for key share
  `;
  if (!linkedEngagement)
    throw new AgreementBuilderDraftConflict(
      "The reviewed engagement is no longer available for this client.",
    );
  const agreement = await runAgreementCommand(
    tx,
    organisationId,
    {
      action: "create",
      draft: complete.draft,
      engagementId: complete.engagementId,
    },
    actorId,
    correlationId,
  );
  await tx`
    select operations.finalise_agreement_builder_draft(
      ${builderDraft.id},
      ${organisationId},
      ${builderDraft.version},
      ${agreement.id}
    )
  `;
  return agreement;
}

export function saveStaffAgreementBuilderDraft(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  command: SaveAgreementBuilderDraftCommand,
  correlationId: string,
): Promise<AgreementBuilderDraft>;
export function saveStaffAgreementBuilderDraft(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  command: FinaliseAgreementBuilderDraftCommand,
  correlationId: string,
): Promise<AgreementRecord>;
export function saveStaffAgreementBuilderDraft(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  command: unknown,
  correlationId: string,
): Promise<AgreementBuilderDraft | AgreementRecord>;
export async function saveStaffAgreementBuilderDraft(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<AgreementBuilderDraft | AgreementRecord> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const command = agreementBuilderDraftCommandSchema.parse(raw);

  try {
    if (command.action === "save") {
      return await withFssAdminTransaction(db, admin, (tx) =>
        saveDraft(tx, organisationId, command),
      );
    }
    return await withFssAdminTransaction(db, admin, (tx) =>
      finaliseDraft(tx, admin.actorId, organisationId, command, correlationId),
    );
  } catch (error) {
    return draftConflict(error);
  }
}

export async function loadStaffAgreementBuilderDraft(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  draftId: string,
): Promise<AgreementBuilderDraft | null> {
  z.uuid().parse(organisationId);
  z.uuid().parse(draftId);

  try {
    return await withFssAdminTransaction(db, admin, async (tx) => {
      const [draft] = await tx<AgreementBuilderDraftRow[]>`
        select id,
          organisation_id as "organisationId",
          engagement_id as "engagementId",
          step,
          content,
          version,
          created_at::text as "createdAt",
          updated_at::text as "updatedAt"
        from operations.load_agreement_builder_draft(
          ${draftId},
          ${organisationId},
          ${null}
        )
      `;
      return draft ? agreementBuilderDraftSchema.parse(draft) : null;
    });
  } catch (error) {
    return draftConflict(error);
  }
}
