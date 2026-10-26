import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createLiveGmailClient,
  GmailNotConnectedError,
} from "../integrations/gmail/live-client";
import type { TokenDecryptionKeys } from "../integrations/token-crypto";
import { FirstEmailApprovalError } from "./approval";
import { postgresFirstEmailApprovalRepository } from "./approval-repository";
import { createOutreachDispatcher } from "./dispatcher";
import { postgresSequenceDispatchRepository } from "./dispatcher-repository";
import {
  createMessageActionHandler,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "./message-action-route";
import {
  createResearchEmailApprover,
  researchEmailApprovalBodySchema,
  type ResearchEmailApprovalInput,
} from "./research-email-approval";

export type ResearchEmailSendResult = {
  status: "sent" | "pending" | "failed" | "cancelled";
  sequenceEnrollmentId: string;
};
export type ResearchEmailSendDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  founderEmail: string;
  gmailClientId: string;
  gmailClientSecret: string;
  decryptionKeys: TokenDecryptionKeys;
  authorizeFounder?: () => Promise<FounderSession>;
  send?: (
    input: ResearchEmailApprovalInput,
  ) => Promise<ResearchEmailSendResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createResearchEmailSendHandler(
  dependencies: ResearchEmailSendDependencies,
): MessageActionRouteHandler {
  const send =
    dependencies.send ??
    (async (input) => {
      const gmailClient = await createLiveGmailClient(dependencies.db, {
        clientId: dependencies.gmailClientId,
        clientSecret: dependencies.gmailClientSecret,
        subjectEmail: dependencies.founderEmail,
        decryptionKeys: dependencies.decryptionKeys,
      });
      const approved = await createResearchEmailApprover({
        repository: postgresFirstEmailApprovalRepository,
        founderEmail: dependencies.founderEmail,
      })(dependencies.db, input);
      const dispatch = createOutreachDispatcher({
        repository: postgresSequenceDispatchRepository,
        gmailClient,
        founderEmail: dependencies.founderEmail,
        maxMessagesPerRun: 1,
      });
      const summary = await dispatch(
        dependencies.db,
        new Date(),
        approved.messageId,
      );
      return {
        status:
          summary.sent + summary.reconciled > 0
            ? ("sent" as const)
            : summary.permanentFailures > 0
              ? ("failed" as const)
              : summary.cancelled > 0
                ? ("cancelled" as const)
                : ("pending" as const),
        sequenceEnrollmentId: approved.sequenceEnrollmentId,
      };
    });
  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema: researchEmailApprovalBodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId, founder, correlationId, body }) =>
      send({ ...body, draftTaskId, founder, correlationId }),
    mapActionError: (error) => {
      if (error instanceof GmailNotConnectedError)
        return {
          status: 409,
          code: "gmail_not_connected",
          message: "Reconnect Gmail in Settings before sending.",
        };
      if (!(error instanceof FirstEmailApprovalError)) return null;
      const messages = {
        not_found: "This draft was not found.",
        not_approvable:
          "This draft has already been reviewed or the prospect is no longer eligible.",
        version_conflict:
          "The draft or contact changed. Reload and review the latest version.",
        suppressed_contact: "This contact is suppressed and cannot be emailed.",
        non_corporate_contact: "Verify the business status before sending.",
        invalid_stored_draft: "The stored draft failed content validation.",
        unapproved_visual: "The visual has not been approved.",
        gmail_draft_failed: "Gmail did not confirm delivery.",
      };
      return {
        status:
          error.code === "not_found"
            ? 404
            : error.code === "version_conflict" ||
                error.code === "not_approvable"
              ? 409
              : 422,
        code: error.code,
        message: messages[error.code],
      };
    },
  });
}
