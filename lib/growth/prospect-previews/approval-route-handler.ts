import { z } from "zod";

import { requireFounder, type FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createMessageActionHandler,
  type MessageActionErrorMapping,
  type MessageActionRouteConfig,
  type MessageActionRouteHandler,
} from "../sequences/message-action-route";
import {
  approveProspectPreview as defaultApproveProspectPreview,
  ProspectPreviewApprovalError,
  type ApproveProspectPreviewInput,
  type ApproveProspectPreviewResult,
  type ProspectPreviewApprovalErrorCode,
} from "./approval";

const bodySchema = z
  .object({
    expectedProspectVersion: z.number().int().min(1),
    expectedPreviewVersion: z.number().int().min(1),
  })
  .strict();

const ERROR_MAPPING: Record<
  ProspectPreviewApprovalErrorCode,
  MessageActionErrorMapping
> = {
  not_found: {
    status: 404,
    code: "not_found",
    message: "The prospect preview was not found.",
  },
  version_conflict: {
    status: 409,
    code: "version_conflict",
    message: "This prospect changed since you loaded it. Refresh and try again.",
  },
  not_publishable: {
    status: 409,
    code: "not_publishable",
    message: "This prospect preview cannot be published in its current state.",
  },
  invalid_draft: {
    status: 409,
    code: "invalid_draft",
    message: "The stored first-email draft cannot be updated safely.",
  },
};

export type ProspectPreviewApprovalRouteDependencies = {
  db: GrowthDb;
  config: MessageActionRouteConfig;
  authorizeFounder?: () => Promise<FounderSession>;
  approveProspectPreview?: (
    db: GrowthDb,
    input: ApproveProspectPreviewInput,
  ) => Promise<ApproveProspectPreviewResult>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    error: unknown;
  }) => void;
};

export function createProspectPreviewApprovalRouteHandler(
  dependencies: ProspectPreviewApprovalRouteDependencies,
): MessageActionRouteHandler {
  const approve =
    dependencies.approveProspectPreview ?? defaultApproveProspectPreview;

  return createMessageActionHandler({
    config: dependencies.config,
    authorizeFounder: dependencies.authorizeFounder ?? requireFounder,
    bodySchema,
    createCorrelationId: dependencies.createCorrelationId,
    reportUnexpectedError: dependencies.reportUnexpectedError,
    action: ({ draftTaskId: prospectId, founder, correlationId, body }) =>
      approve(dependencies.db, {
        prospectId,
        expectedProspectVersion: body.expectedProspectVersion,
        expectedPreviewVersion: body.expectedPreviewVersion,
        founder,
        correlationId,
      }),
    mapActionError: (error) =>
      error instanceof ProspectPreviewApprovalError
        ? ERROR_MAPPING[error.code]
        : null,
  });
}
