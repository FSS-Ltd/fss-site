import { randomBytes } from "node:crypto";

import type { GrowthTransaction } from "../db/types";
import type { StoredProspectPreviewSnapshot } from "./types";

export type InsertDraftProspectPreviewInput = {
  prospectId: string;
  publicId: string;
  content: StoredProspectPreviewSnapshot;
};

type CreatePublicId = () => string;

export type InsertDraftProspectPreviewWithRetryInput = Omit<
  InsertDraftProspectPreviewInput,
  "publicId"
>;

function createPublicId(): string {
  return randomBytes(24).toString("base64url");
}

function isPublicIdUniqueKeyCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as { code?: unknown; constraint_name?: unknown };
  return (
    candidate.code === "23505" &&
    candidate.constraint_name === "prospect_previews_public_id_key"
  );
}

export async function insertDraftProspectPreview(
  transaction: GrowthTransaction,
  input: InsertDraftProspectPreviewInput,
): Promise<void> {
  await transaction`
    insert into growth.prospect_previews (
      prospect_id,
      public_id,
      status,
      content_snapshot
    ) values (
      ${input.prospectId},
      ${input.publicId},
      'draft',
      ${transaction.json(input.content)}
    )
  `;
}

export async function insertDraftProspectPreviewWithRetry(
  transaction: GrowthTransaction,
  input: InsertDraftProspectPreviewWithRetryInput,
  createId: CreatePublicId = createPublicId,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await insertDraftProspectPreview(transaction, {
        ...input,
        publicId: createId(),
      });
      return;
    } catch (error) {
      if (!isPublicIdUniqueKeyCollision(error) || attempt === 2) {
        throw error;
      }
    }
  }
}
