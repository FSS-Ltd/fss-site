import { z } from "zod";
import type { FssAdminContext } from "../auth/staff-types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { OperationsDb } from "../db/client";
import {
  parseWorkspacePage,
  toWorkspaceCollectionPage,
  type WorkspaceCollectionPage,
} from "../workspaces/pagination";
import { agreementBuilderStepSchema } from "./builder-draft-schema";

const draftSummarySchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200).nullable(),
  step: agreementBuilderStepSchema,
  version: z.number().int().positive(),
  updatedAt: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)))
    .transform((value) => new Date(value).toISOString()),
});

export type AgreementBuilderDraftSummary = z.infer<typeof draftSummarySchema>;

export async function listStaffAgreementBuilderDrafts(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  page = 1,
): Promise<WorkspaceCollectionPage<AgreementBuilderDraftSummary>> {
  z.uuid().parse(organisationId);
  const requestedPage = parseWorkspacePage(page);
  return withFssAdminTransaction(db, admin, async (tx) => {
    const rows = await tx<AgreementBuilderDraftSummary[]>`
      select id, title, step, version, updated_at::text as "updatedAt"
      from operations.list_agreement_builder_drafts(${organisationId}, ${requestedPage})
    `;
    return toWorkspaceCollectionPage(
      z.array(draftSummarySchema).parse(rows),
      requestedPage,
    );
  });
}
