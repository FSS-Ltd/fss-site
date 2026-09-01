import { z } from "zod";

import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  approveSeoAuditDraft,
  SeoAuditApprovalError,
  type ApprovedSeoAuditMessage,
  type ApproveSeoAuditDraftInput,
  type SeoAuditApprovalErrorCode,
} from "./repository";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "../sequences/message-action-route";

const bodySchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

const ERROR_MAPPING: Record<
  SeoAuditApprovalErrorCode,
  MessageActionErrorMapping
> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The SEO audit draft was not found.",
  },
  not_approvable: {
    status: 409,
    code: "not_approvable",
    message: "The SEO audit draft can no longer be approved.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "The SEO audit draft changed. Reload and try again.",
  },
  suppressed_contact: {
    status: 422,
    code: "suppressed_contact",
    message: "This contact is suppressed and cannot be emailed.",
  },
  non_corporate_contact: {
    status: 422,
    code: "non_corporate_contact",
    message: "This contact is not an eligible active corporate subscriber.",
  },
  reply_detected: {
    status: 409,
    code: "reply_detected",
    message: "This prospect replied, so the audit follow-up will not be sent.",
  },
  invalid_stored_draft: {
    status: 422,
    code: "invalid_stored_draft",
    message: "The stored SEO audit draft is invalid.",
  },
};

export type SeoAuditApprovalRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  now?: () => Date;
  authorizeFounder?: () => Promise<FounderSession>;
  approveDraft?: (
    db: GrowthDb,
    input: ApproveSeoAuditDraftInput,
  ) => Promise<ApprovedSeoAuditMessage>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createSeoAuditApprovalHandler(
  dependencies: SeoAuditApprovalRouteDependencies,
): MessageActionRouteHandler {
  const now = dependencies.now ?? (() => new Date());
  const approveDraft =
    dependencies.approveDraft ??
    ((db, input) => approveSeoAuditDraft(db, input, now()));

  return createMessageActionHandler({
    config: dependencies.config,
    bodySchema,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId, founder, correlationId, body }) =>
      approveDraft(dependencies.db, {
        auditId: draftTaskId,
        expectedVersion: body.expectedVersion,
        founderActorId: founder.actorId,
        correlationId,
      }),
    mapActionError: (error) =>
      error instanceof SeoAuditApprovalError ? ERROR_MAPPING[error.code] : null,
  });
}
