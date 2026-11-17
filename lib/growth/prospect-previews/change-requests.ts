import { createHash } from "node:crypto";
import { appendAuditEvent } from "../audit/service";
import { getGrowthDb, withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ACTOR_ID_PATTERN = /^[a-f0-9]{64}$/;
export class PreviewPilotRequestError extends Error {
  constructor(
    readonly code:
      | "pilot_request_id_required"
      | "request_conflict"
      | "pilot_revision_already_requested",
  ) {
    super(code);
    this.name = "PreviewPilotRequestError";
  }
}
export type CreatePreviewChangeRequestInput = {
  prospectId: string;
  compositionDigest: string;
  notes: string;
  createdBy: string;
  requestId?: string;
};
export type PreviewChangeRequest = {
  id: string;
  generationPrNumber: number | null;
};
function validateInput(input: CreatePreviewChangeRequestInput): void {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !DIGEST_PATTERN.test(input.compositionDigest) ||
    !ACTOR_ID_PATTERN.test(input.createdBy) ||
    input.notes !== input.notes.trim() ||
    input.notes.length < 1 ||
    input.notes.length > 2_000 ||
    (input.requestId !== undefined &&
      !PROSPECT_ID_PATTERN.test(input.requestId))
  )
    throw new TypeError("Preview change request is invalid.");
}
export async function createPreviewChangeRequest(
  input: CreatePreviewChangeRequestInput,
  db: GrowthDb = getGrowthDb(),
): Promise<PreviewChangeRequest | null> {
  validateInput(input);
  return withGrowthTransaction(db, async (tx) => {
    if (input.requestId)
      await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:preview-request:${input.requestId}`},0))`;
    await tx`select id from growth.prospects where id=${input.prospectId} for update`;
    const [allocation] = await tx<
      { slot: number }[]
    >`select slot from growth.facebook_pilot_allocations where prospect_id=${input.prospectId}`;
    let requestHash: string | null = null;
    if (allocation) {
      if (!input.requestId)
        throw new PreviewPilotRequestError("pilot_request_id_required");
      requestHash = createHash("sha256")
        .update(
          JSON.stringify({
            prospectId: input.prospectId,
            compositionDigest: input.compositionDigest,
            notes: input.notes,
          }),
        )
        .digest("hex");
      const [prior] = await tx<
        (PreviewChangeRequest & { hash: string; actor: string })[]
      >`select id,generation_pr_number as "generationPrNumber",request_hash as hash,created_by as actor from growth.prospect_preview_change_requests where request_id=${input.requestId}`;
      if (prior) {
        if (prior.hash !== requestHash || prior.actor !== input.createdBy)
          throw new PreviewPilotRequestError("request_conflict");
        return { id: prior.id, generationPrNumber: prior.generationPrNumber };
      }
      const [existing] =
        await tx`select id from growth.prospect_preview_change_requests where facebook_pilot_slot=${allocation.slot}`;
      if (existing)
        throw new PreviewPilotRequestError("pilot_revision_already_requested");
    }
    const [row] = await tx<
      PreviewChangeRequest[]
    >`insert into growth.prospect_preview_change_requests (prospect_preview_id,composition_digest,generation_pr_number,notes,created_by,facebook_pilot_slot,request_id,request_hash)
      select pp.id,${input.compositionDigest},pp.generation_pr_number,${input.notes},${input.createdBy},${allocation?.slot ?? null},${allocation ? (input.requestId ?? null) : null},${requestHash}
      from growth.prospect_previews pp where pp.prospect_id=${input.prospectId} and pp.composition_digest=${input.compositionDigest} and pp.status='draft' and pp.generation_status in ('pr_open','merged_draft') returning id,generation_pr_number as "generationPrNumber"`;
    if (row && allocation && input.requestId)
      await appendAuditEvent(tx, {
        correlationId: input.requestId,
        actorType: "founder",
        actorId: input.createdBy,
        action: "facebook.request_pilot_revision",
        entityType: "prospect_preview_change_request",
        entityId: row.id,
      });
    return row ?? null;
  });
}
