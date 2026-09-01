import { z } from "zod";

import type { GrowthDb } from "../db/types";

import type { SeoAuditBlobStorage } from "./blob";
import {
  AgentRequestTooLargeError,
  failureResponse,
  isAuthenticatedAgentRequest,
  jsonResponse,
  parseRawAgentJson,
  readRawAgentBody,
  type AgentRequestAuthentication,
} from "./agent-request";
import {
  regenerateSeoAuditReports,
  SeoAuditReportRegenerationError,
} from "./report-regeneration";

const requestSchema = z
  .object({ auditIds: z.array(z.string().uuid()).min(1).max(5) })
  .refine(
    ({ auditIds }) => new Set(auditIds).size === auditIds.length,
    "Audit IDs must be unique.",
  )
  .strict();

export type SeoAuditReportRegenerationHandlerDependencies =
  AgentRequestAuthentication & {
    db: GrowthDb;
    blobStorage: SeoAuditBlobStorage;
    createCorrelationId: () => string;
    reportUnexpectedError: (input: {
      correlationId: string;
      error: unknown;
    }) => void;
    regenerateReports?: (input: {
      auditIds: readonly string[];
      correlationId: string;
    }) => Promise<number>;
  };

export function createSeoAuditReportRegenerationHandler(
  dependencies: SeoAuditReportRegenerationHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    let rawBody: Uint8Array;
    try {
      rawBody = await readRawAgentBody(request);
    } catch (error) {
      if (error instanceof AgentRequestTooLargeError) {
        return failureResponse(
          413,
          "payload_too_large",
          "Request body exceeds 128 KB.",
          correlationId,
        );
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return failureResponse(
        400,
        "invalid_body",
        "Unable to read the request body.",
        correlationId,
      );
    }
    if (!isAuthenticatedAgentRequest(request, rawBody, dependencies)) {
      return failureResponse(
        401,
        "unauthorized",
        "Request authentication failed.",
        correlationId,
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = parseRawAgentJson(rawBody);
    } catch {
      return failureResponse(
        400,
        "invalid_json",
        "Request body must be valid JSON.",
        correlationId,
      );
    }
    const parsed = requestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return failureResponse(
        422,
        "invalid_fields",
        "Audit regeneration request fields are invalid.",
        correlationId,
      );
    }

    try {
      const regeneratedCount = await (
        dependencies.regenerateReports ??
        ((input) =>
          regenerateSeoAuditReports({
            db: dependencies.db,
            blobStorage: dependencies.blobStorage,
            auditIds: input.auditIds,
            correlationId: input.correlationId,
            now: dependencies.now(),
          }))
      )({ auditIds: parsed.data.auditIds, correlationId });
      return jsonResponse({ ok: true, correlationId, regeneratedCount }, 200);
    } catch (error) {
      const status =
        error instanceof SeoAuditReportRegenerationError &&
        error.code === "not_found"
          ? 404
          : 409;
      if (!(error instanceof SeoAuditReportRegenerationError)) {
        dependencies.reportUnexpectedError({ correlationId, error });
      }
      return failureResponse(
        status,
        "regeneration_unavailable",
        "The SEO audit report could not be regenerated.",
        correlationId,
      );
    }
  };
}
