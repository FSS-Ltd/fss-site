import { z } from "zod";

import {
  AgentRequestTooLargeError,
  failureResponse,
  isAuthenticatedAgentRequest,
  jsonResponse,
  parseRawAgentJson,
  readRawAgentBody,
  type AgentRequestAuthentication,
} from "./agent-request";
import { releaseSeoAuditClaims } from "./repository";
import type { GrowthDb } from "../db/types";

const auditIdSchema = z.string().uuid();
const releaseRequestSchema = z
  .object({ auditIds: z.array(auditIdSchema).min(1).max(5) })
  .strict();

export type SeoAuditClaimReleaseHandlerDependencies =
  AgentRequestAuthentication & {
    db: GrowthDb;
    createCorrelationId: () => string;
    reportUnexpectedError: (input: {
      correlationId: string;
      error: unknown;
    }) => void;
    releaseClaims?: (
      input: { auditIds: readonly string[]; correlationId: string },
      now: Date,
    ) => Promise<number>;
  };

export function createSeoAuditClaimReleaseHandler(
  dependencies: SeoAuditClaimReleaseHandlerDependencies,
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
    const parsed = releaseRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return failureResponse(
        422,
        "invalid_fields",
        "Audit release fields are invalid.",
        correlationId,
      );
    }

    try {
      const releasedCount = await (
        dependencies.releaseClaims ??
        ((input, now) => releaseSeoAuditClaims(dependencies.db, input, now))
      )({ auditIds: parsed.data.auditIds, correlationId }, dependencies.now());
      return jsonResponse({ ok: true, correlationId, releasedCount }, 200);
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return failureResponse(
        500,
        "internal_error",
        "Unable to release audit claims.",
        correlationId,
      );
    }
  };
}
