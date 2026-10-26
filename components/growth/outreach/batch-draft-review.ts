import { z } from "zod";
import {
  postResearchDraftAction,
  type ResearchDraftResponse,
} from "./research-draft-request";
import type { ResearchPermission } from "./research-permission-fields";

const reviewSchema = z.object({
  status: z.literal("ready"),
  data: z.object({
    draftTaskId: z.uuid(),
    version: z.number().int().positive(),
    prospectVersion: z.number().int().positive(),
    businessName: z.string(),
    contactName: z.string(),
    contactEmail: z.string(),
    subject: z.string(),
    previewText: z.string(),
    researchOnly: z.boolean().optional(),
    approvalFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    eligibility: z.object({ ready: z.boolean(), reasons: z.array(z.string()) }),
  }),
});

export type BatchReviewMessage = z.infer<typeof reviewSchema>["data"];
export type BatchDraftEntry = {
  draftTaskId: string;
  businessName: string;
  message: BatchReviewMessage | null;
  result: ResearchDraftResponse | null;
  error: string | null;
};

export function canSendBatchDraft(entry: BatchDraftEntry): boolean {
  const message = entry.message;
  return Boolean(
    message?.eligibility.ready &&
    (!message.researchOnly || message.approvalFingerprint),
  );
}

export async function loadBatchDraft(
  draftTaskId: string,
  signal: AbortSignal,
): Promise<BatchReviewMessage> {
  const response = await fetch(`/api/growth/messages/${draftTaskId}/review`, {
    signal,
    cache: "no-store",
  });
  const payload: unknown = await response.json();
  const parsed = reviewSchema.safeParse(payload);
  if (
    !response.ok ||
    !parsed.success ||
    parsed.data.data.draftTaskId !== draftTaskId
  ) {
    throw new Error(
      "This draft could not load or is no longer available. Open its review for the latest state.",
    );
  }
  return parsed.data.data;
}

export async function sendBatchDraft(
  entry: BatchDraftEntry,
  permission: ResearchPermission,
): Promise<ResearchDraftResponse> {
  const message = entry.message;
  if (!message || !canSendBatchDraft(entry))
    throw new Error("This draft is not ready to send.");
  return postResearchDraftAction(
    `/api/growth/messages/${entry.draftTaskId}/${message.researchOnly ? "approve-research-send" : "approve-send"}`,
    message.researchOnly
      ? {
          expectedVersion: message.version,
          expectedProspectVersion: message.prospectVersion,
          fingerprint: message.approvalFingerprint,
          permission,
        }
      : { expectedVersion: message.version },
  );
}
