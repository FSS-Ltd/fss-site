import { randomUUID } from "node:crypto";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  EMAIL_ASSET_FALLBACKS,
  type EmailAssetFallbackKey,
} from "../email/assets/fallbacks";
import { renderGmailMime } from "../email/gmail/mime";
import {
  renderApprovedFirstEmailContent,
  type RenderableFirstEmailVisual,
} from "../email/gmail/render";
import type { GmailClient } from "../integrations/gmail/types";
import {
  InvalidStoredFirstEmailDraftError,
  parseStoredFirstEmailDraft,
  type StoredFirstEmailDraft,
  type StoredFirstEmailVisual,
} from "./first-email-draft-snapshot";

const DRAFT_TASK_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

export type LockedApprovalDraft = StoredFirstEmailDraft & {
  contactId: string;
  contactEmail: string;
  normalisedEmail: string;
  subscriberType: string;
  corporateStatus: string;
};

export type ApprovedVisualAsset = {
  url: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  reviewStatus: string;
};

export type FirstEmailMessageWrite = {
  id: string;
  subjectSnapshot: string;
  htmlSnapshot: string;
  textSnapshot: string;
  emailAssetId: string | null;
  rfcMessageId: string;
  idempotencyKey: string;
  status: "queued" | "draft";
  scheduledFor: Date | null;
};

export type CreateEnrollmentAndMessageInput = {
  prospectId: string;
  contactId: string;
  enrollmentStatus: "active" | "pending_approval";
  message: FirstEmailMessageWrite;
};

export type RecordProviderDraftInput = {
  messageId: string;
  providerDraftId: string;
  providerThreadId: string;
};

export type AppendApprovalAuditInput = {
  correlationId: string;
  actorId: string;
  draftTaskId: string;
};

export interface FirstEmailApprovalTransaction {
  lockDraft(draftTaskId: string): Promise<LockedApprovalDraft | null>;
  isSuppressed(normalisedEmail: string): Promise<boolean>;
  getApprovedAsset(
    assetId: string,
    prospectId: string,
  ): Promise<ApprovedVisualAsset | null>;
  createEnrollmentAndFirstMessage(
    input: CreateEnrollmentAndMessageInput,
  ): Promise<{ sequenceEnrollmentId: string }>;
  markDraftReviewState(
    draftTaskId: string,
    outputSnapshot: Record<string, unknown>,
  ): Promise<void>;
  appendApprovalAudit(input: AppendApprovalAuditInput): Promise<void>;
}

export interface FirstEmailApprovalRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: FirstEmailApprovalTransaction) => Promise<T>,
  ): Promise<T>;
  recordProviderDraft(
    db: GrowthDb,
    input: RecordProviderDraftInput,
  ): Promise<void>;
}

export type ApproveFirstEmailInput = {
  draftTaskId: string;
  expectedVersion: number;
  founder: FounderSession;
  correlationId: string;
  sendMode: "queue" | "gmail_draft";
};

export type ApprovedFirstEmailMessage = {
  draftTaskId: string;
  sequenceEnrollmentId: string;
  messageId: string;
  status: "queued" | "provider_draft";
  rfcMessageId: string;
};

export type FirstEmailApprovalErrorCode =
  | "not_found"
  | "not_approvable"
  | "version_conflict"
  | "suppressed_contact"
  | "non_corporate_contact"
  | "unapproved_visual"
  | "invalid_stored_draft"
  | "gmail_draft_failed";

export class FirstEmailApprovalError extends Error {
  constructor(readonly code: FirstEmailApprovalErrorCode) {
    super("The first email could not be approved.");
    this.name = "FirstEmailApprovalError";
  }
}

function isFallbackKey(value: string): value is EmailAssetFallbackKey {
  return Object.hasOwn(EMAIL_ASSET_FALLBACKS, value);
}

async function resolveVisual(
  transaction: FirstEmailApprovalTransaction,
  prospectId: string,
  visual: StoredFirstEmailVisual,
  siteOrigin: string,
): Promise<RenderableFirstEmailVisual> {
  if (visual.kind === "fallback") {
    if (!isFallbackKey(visual.fallbackAssetKey)) {
      throw new FirstEmailApprovalError("invalid_stored_draft");
    }
    return {
      kind: "fallback",
      fallbackKey: visual.fallbackAssetKey,
      siteOrigin,
      conceptDisclaimer: visual.conceptDisclaimer,
    };
  }

  const asset = await transaction.getApprovedAsset(visual.assetId, prospectId);
  if (!asset || asset.reviewStatus !== "approved") {
    throw new FirstEmailApprovalError("unapproved_visual");
  }
  return {
    kind: "approved",
    assetId: visual.assetId,
    url: asset.url,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
    altText: asset.altText,
    conceptDisclaimer: visual.conceptDisclaimer,
  };
}

function validateRequest(input: ApproveFirstEmailInput): void {
  if (
    !DRAFT_TASK_ID_PATTERN.test(input.draftTaskId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId) ||
    (input.sendMode !== "queue" && input.sendMode !== "gmail_draft")
  ) {
    throw new TypeError("First-email approval request is invalid.");
  }
}

type FirstEmailApproverDependencies = {
  repository: FirstEmailApprovalRepository;
  gmailClient: Pick<GmailClient, "createDraft">;
  founderEmail: string;
  siteOrigin: string;
  now?: () => Date;
  createMessageId?: () => string;
};

export function createFirstEmailApprover({
  repository,
  gmailClient,
  founderEmail,
  siteOrigin,
  now = () => new Date(),
  createMessageId = () => randomUUID(),
}: FirstEmailApproverDependencies) {
  return async function approve(
    db: GrowthDb,
    input: ApproveFirstEmailInput,
  ): Promise<ApprovedFirstEmailMessage> {
    validateRequest(input);

    const committed = await repository.withTransaction(
      db,
      async (transaction) => {
        const draft = await transaction.lockDraft(input.draftTaskId);
        if (!draft) throw new FirstEmailApprovalError("not_found");

        let stored;
        try {
          stored = parseStoredFirstEmailDraft(draft);
        } catch (error) {
          if (error instanceof InvalidStoredFirstEmailDraftError) {
            throw new FirstEmailApprovalError("invalid_stored_draft");
          }
          throw error;
        }

        if (
          draft.status !== "completed" ||
          stored.reviewState !== "draft" ||
          draft.hasEnrollment
        ) {
          throw new FirstEmailApprovalError("not_approvable");
        }
        if (stored.version !== input.expectedVersion) {
          throw new FirstEmailApprovalError("version_conflict");
        }
        if (await transaction.isSuppressed(draft.normalisedEmail)) {
          throw new FirstEmailApprovalError("suppressed_contact");
        }
        if (
          draft.subscriberType !== "corporate" ||
          draft.corporateStatus !== "active"
        ) {
          throw new FirstEmailApprovalError("non_corporate_contact");
        }

        const visual = await resolveVisual(
          transaction,
          draft.prospectId,
          stored.visual,
          siteOrigin,
        );
        const messageId = createMessageId();
        const content = renderApprovedFirstEmailContent({
          snapshot: stored.email,
          visual,
        });
        const rendered = renderGmailMime({
          id: messageId,
          from: founderEmail,
          to: draft.contactEmail,
          replyTo: founderEmail,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });

        const messageStatus = input.sendMode === "queue" ? "queued" : "draft";
        const enrollmentStatus =
          input.sendMode === "queue" ? "active" : "pending_approval";
        const emailAssetId =
          stored.visual.kind === "stored" ? stored.visual.assetId : null;

        const { sequenceEnrollmentId } =
          await transaction.createEnrollmentAndFirstMessage({
            prospectId: draft.prospectId,
            contactId: draft.contactId,
            enrollmentStatus,
            message: {
              id: messageId,
              subjectSnapshot: content.subject,
              htmlSnapshot: content.html,
              textSnapshot: content.text,
              emailAssetId,
              rfcMessageId: rendered.rfcMessageId,
              idempotencyKey: `first_email:${draft.id}`,
              status: messageStatus,
              scheduledFor: input.sendMode === "queue" ? now() : null,
            },
          });

        await transaction.markDraftReviewState(draft.id, {
          ...stored.snapshot,
          reviewState:
            input.sendMode === "queue" ? "approved" : "provider_draft",
        });
        await transaction.appendApprovalAudit({
          correlationId: input.correlationId,
          actorId: input.founder.actorId,
          draftTaskId: draft.id,
        });

        return {
          sequenceEnrollmentId,
          messageId,
          messageStatus,
          rfcMessageId: rendered.rfcMessageId,
          raw: rendered.raw,
        };
      },
    );

    if (input.sendMode === "queue") {
      return {
        draftTaskId: input.draftTaskId,
        sequenceEnrollmentId: committed.sequenceEnrollmentId,
        messageId: committed.messageId,
        status: "queued",
        rfcMessageId: committed.rfcMessageId,
      };
    }

    let draftResult;
    try {
      draftResult = await gmailClient.createDraft({ raw: committed.raw });
    } catch {
      throw new FirstEmailApprovalError("gmail_draft_failed");
    }
    await repository.recordProviderDraft(db, {
      messageId: committed.messageId,
      providerDraftId: draftResult.draftId,
      providerThreadId: draftResult.gmailThreadId,
    });

    return {
      draftTaskId: input.draftTaskId,
      sequenceEnrollmentId: committed.sequenceEnrollmentId,
      messageId: committed.messageId,
      status: "provider_draft",
      rfcMessageId: committed.rfcMessageId,
    };
  };
}
