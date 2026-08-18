import { z } from "zod";

import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  type ApprovedFirstEmailMessage,
  type ApproveFirstEmailInput,
  createFirstEmailApprover,
  FirstEmailApprovalError,
  type FirstEmailApprovalErrorCode,
} from "./approval";
import { postgresFirstEmailApprovalRepository } from "./approval-repository";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "./message-action-route";

const bodySchema = z.object({
  expectedVersion: z.number().int().positive(),
});

const ERROR_MAPPING: Record<
  FirstEmailApprovalErrorCode,
  MessageActionErrorMapping
> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The first-email draft was not found.",
  },
  not_approvable: {
    status: 409,
    code: "not_approvable",
    message: "The first-email draft can no longer be approved.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "The first-email draft has changed. Reload and try again.",
  },
  suppressed_contact: {
    status: 422,
    code: "suppressed_contact",
    message: "This contact is suppressed and cannot be emailed.",
  },
  non_corporate_contact: {
    status: 422,
    code: "non_corporate_contact",
    message: "This contact is not an eligible corporate subscriber.",
  },
  unapproved_visual: {
    status: 422,
    code: "unapproved_visual",
    message: "The selected image is missing or not yet approved.",
  },
  invalid_stored_draft: {
    status: 422,
    code: "invalid_stored_draft",
    message: "The stored draft is invalid.",
  },
  gmail_draft_failed: {
    status: 502,
    code: "gmail_draft_failed",
    message: "Gmail did not confirm the draft.",
  },
};

const NEVER_CREATE_DRAFT = {
  createDraft: async () => {
    throw new Error("Gmail draft creation is not available for a queued send.");
  },
};

export type ApproveSendRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  founderEmail: string;
  siteOrigin: string;
  authorizeFounder?: () => Promise<FounderSession>;
  approveDraft?: (
    db: GrowthDb,
    input: ApproveFirstEmailInput,
  ) => Promise<ApprovedFirstEmailMessage>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createApproveSendHandler(
  dependencies: ApproveSendRouteDependencies,
): MessageActionRouteHandler {
  const approveDraft =
    dependencies.approveDraft ??
    createFirstEmailApprover({
      repository: postgresFirstEmailApprovalRepository,
      gmailClient: NEVER_CREATE_DRAFT,
      founderEmail: dependencies.founderEmail,
      siteOrigin: dependencies.siteOrigin,
    });

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId, founder, correlationId, body }) =>
      approveDraft(dependencies.db, {
        draftTaskId,
        expectedVersion: body.expectedVersion,
        founder,
        correlationId,
        sendMode: "queue",
      }),
    mapActionError: (error) =>
      error instanceof FirstEmailApprovalError
        ? ERROR_MAPPING[error.code]
        : null,
  });
}
