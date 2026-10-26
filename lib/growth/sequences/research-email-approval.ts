import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { renderGmailMime } from "../email/gmail/mime";
import {
  FirstEmailApprovalError,
  type ApprovedFirstEmailMessage,
  type FirstEmailApprovalRepository,
} from "./approval";
import {
  researchEmailFingerprint,
  researchEmailSnapshotSchema,
  researchOutreachPermissionSchema,
} from "./research-email-snapshot";

export const researchEmailApprovalBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    expectedProspectVersion: z.number().int().positive(),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    permission: researchOutreachPermissionSchema,
  })
  .strict();

export type ResearchEmailApprovalInput = z.infer<
  typeof researchEmailApprovalBodySchema
> & {
  draftTaskId: string;
  founder: FounderSession;
  correlationId: string;
};

export function createResearchEmailApprover({
  repository,
  founderEmail,
  now = () => new Date(),
  createMessageId = randomUUID,
}: {
  repository: FirstEmailApprovalRepository;
  founderEmail: string;
  now?: () => Date;
  createMessageId?: () => string;
}) {
  return async (
    db: GrowthDb,
    input: ResearchEmailApprovalInput,
  ): Promise<ApprovedFirstEmailMessage> => {
    if (
      !z.uuid().safeParse(input.draftTaskId).success ||
      !/^[0-9a-f]{64}$/.test(input.founder.actorId) ||
      !input.correlationId.trim()
    )
      throw new TypeError("Invalid research approval request.");
    const body = researchEmailApprovalBodySchema.parse({
      expectedVersion: input.expectedVersion,
      expectedProspectVersion: input.expectedProspectVersion,
      fingerprint: input.fingerprint,
      permission: input.permission,
    });
    return repository.withTransaction(db, async (tx) => {
      const draft = await tx.lockDraft(input.draftTaskId);
      if (!draft) throw new FirstEmailApprovalError("not_found");
      const parsed = researchEmailSnapshotSchema.safeParse(
        draft.outputSnapshot,
      );
      if (!parsed.success)
        throw new FirstEmailApprovalError("invalid_stored_draft");
      const snapshot = parsed.data;
      if (
        draft.status !== "completed" ||
        draft.prospectStatus !== "ready_for_email_review" ||
        draft.hasEnrollment ||
        snapshot.reviewState !== "research_only"
      )
        throw new FirstEmailApprovalError("not_approvable");
      if (
        snapshot.draftVersion !== body.expectedVersion ||
        draft.prospectVersion !== body.expectedProspectVersion ||
        researchEmailFingerprint(
          snapshot,
          draft.contactEmail,
          draft.prospectVersion,
        ) !== body.fingerprint
      )
        throw new FirstEmailApprovalError("version_conflict");
      if (await tx.isSuppressed(draft.normalisedEmail))
        throw new FirstEmailApprovalError("suppressed_contact");
      if (draft.corporateStatus !== "active")
        throw new FirstEmailApprovalError("non_corporate_contact");
      const approvedAt = now();
      const messageId = createMessageId();
      const rendered = renderGmailMime({
        id: messageId,
        from: founderEmail,
        to: draft.contactEmail,
        replyTo: founderEmail,
        ...snapshot.email,
      });
      await tx.authorizeResearchContact({
        contactId: draft.contactId,
        prospectId: draft.prospectId,
        basis: body.permission.basis,
      });
      const { sequenceEnrollmentId } = await tx.createEnrollmentAndFirstMessage(
        {
          prospectId: draft.prospectId,
          contactId: draft.contactId,
          enrollmentStatus: "active",
          followUpPolicy: "manual_only",
          approvedRecipient: draft.normalisedEmail,
          message: {
            id: messageId,
            subjectSnapshot: snapshot.email.subject,
            htmlSnapshot: snapshot.email.html,
            textSnapshot: snapshot.email.text,
            emailAssetId: null,
            rfcMessageId: rendered.rfcMessageId,
            idempotencyKey: `first_email:${draft.id}`,
            status: "queued",
            scheduledFor: approvedAt,
          },
        },
      );
      await tx.markDraftReviewState(draft.id, {
        ...snapshot,
        reviewState: "approved",
        outreachApproval: {
          ...body.permission,
          actorId: input.founder.actorId,
          approvedAt: approvedAt.toISOString(),
          fingerprint: body.fingerprint,
        },
      });
      await tx.appendApprovalAudit({
        draftTaskId: draft.id,
        actorId: input.founder.actorId,
        correlationId: input.correlationId,
        reasonCode: `research_email.${body.permission.basis}`,
      });
      return {
        draftTaskId: draft.id,
        sequenceEnrollmentId,
        messageId,
        status: "queued",
        rfcMessageId: rendered.rfcMessageId,
      };
    });
  };
}
