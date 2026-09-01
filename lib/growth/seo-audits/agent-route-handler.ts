import { createHash } from "node:crypto";

import { z } from "zod";

import { renderSeoAuditPdf } from "./pdf";
import {
  AgentRequestTooLargeError,
  failureResponse,
  isAuthenticatedAgentRequest,
  jsonResponse,
  parseRawAgentJson,
  readRawAgentBody,
} from "./agent-request";
import {
  claimSeoAuditCandidates,
  completeSeoAuditDraft,
  getSeoAuditDraftRenderContext,
  SeoAuditDraftCompletionError,
  type SeoAuditCandidate,
  type SeoAuditDraftRenderContext,
} from "./repository";
import {
  createStoredSeoAuditDraft,
  seoAuditSubmissionSchema,
  type StoredSeoAuditDraft,
} from "./schema";
import type { SeoAuditBlobStorage } from "./blob";
import type { GrowthDb } from "../db/types";

const claimRequestSchema = z
  .object({ limit: z.number().int().min(1).max(5) })
  .strict();

export type SeoAuditAgentRouteDependencies = {
  db: GrowthDb;
  agentKeyId: string;
  agentHmacSecret: string;
  createCorrelationId: () => string;
  now: () => Date;
  blobStorage: SeoAuditBlobStorage;
  reportUnexpectedError: (input: {
    correlationId: string;
    error: unknown;
  }) => void;
  claimCandidates?: (limit: number, now: Date) => Promise<SeoAuditCandidate[]>;
  getRenderContext?: (
    auditId: string,
  ) => Promise<SeoAuditDraftRenderContext | null>;
  renderPdf?: (
    input: Parameters<typeof renderSeoAuditPdf>[0],
  ) => Promise<Buffer>;
  completeDraft?: (
    input: { auditId: string; outputSnapshot: StoredSeoAuditDraft },
    now: Date,
  ) => Promise<void>;
};

type SeoAuditSubmissionPhase =
  | "render_pdf"
  | "store_report"
  | "build_draft"
  | "complete_draft";

function createSubmissionPhaseError(phase: SeoAuditSubmissionPhase): Error {
  const error = new Error("SEO audit submission failed.");
  error.name = `SeoAuditSubmission${phase
    .split("_")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join("")}Error`;
  return error;
}

function candidateResponse(candidate: SeoAuditCandidate) {
  return {
    auditId: candidate.auditId,
    sequenceEnrollmentId: candidate.sequenceEnrollmentId,
    businessName: candidate.businessName,
    websiteUrl: candidate.websiteUrl,
    sector: candidate.sector,
    locality: candidate.locality,
    contactFirstName: candidate.contactFirstName,
  };
}

export function createSeoAuditClaimHandler(
  dependencies: SeoAuditAgentRouteDependencies,
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
    const parsed = claimRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return failureResponse(
        422,
        "invalid_fields",
        "Request fields are invalid.",
        correlationId,
      );
    }

    try {
      const now = dependencies.now();
      const candidates = await (
        dependencies.claimCandidates ??
        ((limit, claimAt) =>
          claimSeoAuditCandidates(dependencies.db, limit, claimAt))
      )(parsed.data.limit, now);
      return jsonResponse(
        {
          ok: true,
          correlationId,
          candidates: candidates.map(candidateResponse),
        },
        200,
      );
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return failureResponse(
        500,
        "internal_error",
        "Unable to claim audit candidates.",
        correlationId,
      );
    }
  };
}

export function createSeoAuditSubmissionHandler(
  dependencies: SeoAuditAgentRouteDependencies,
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
    const parsed = seoAuditSubmissionSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return failureResponse(
        422,
        "invalid_fields",
        "Audit submission fields are invalid.",
        correlationId,
      );
    }

    let phase: SeoAuditSubmissionPhase = "render_pdf";
    try {
      const context = await (
        dependencies.getRenderContext ??
        ((auditId) => getSeoAuditDraftRenderContext(dependencies.db, auditId))
      )(parsed.data.auditId);
      const now = dependencies.now();
      if (
        !context ||
        context.status !== "claimed" ||
        context.claimExpiresAt === null ||
        context.claimExpiresAt < now
      ) {
        return failureResponse(
          409,
          "claim_unavailable",
          "The audit claim is no longer available.",
          correlationId,
        );
      }

      const pdf = await (dependencies.renderPdf ?? renderSeoAuditPdf)({
        businessName: context.businessName,
        websiteUrl: context.websiteUrl,
        createdAt: now,
        audit: parsed.data.audit,
      });
      const sha256 = createHash("sha256").update(pdf).digest("hex");
      phase = "store_report";
      const storedReport = await dependencies.blobStorage.putReport({
        pathname: `growth-seo-audits/${context.auditId}/audit-${sha256}.pdf`,
        bytes: pdf,
      });
      try {
        phase = "build_draft";
        const outputSnapshot = createStoredSeoAuditDraft({
          submission: parsed.data,
          reportUrl: storedReport.url,
          reportSha256: sha256,
        });
        phase = "complete_draft";
        await (
          dependencies.completeDraft ??
          ((input, completedAt) =>
            completeSeoAuditDraft(dependencies.db, input, completedAt))
        )({ auditId: context.auditId, outputSnapshot }, now);
      } catch (error) {
        await dependencies.blobStorage
          .deleteReport(storedReport.url)
          .catch(() => undefined);
        throw error;
      }

      return jsonResponse(
        {
          ok: true,
          correlationId,
          auditId: context.auditId,
          status: "draft_ready_for_approval",
        },
        201,
      );
    } catch (error) {
      if (error instanceof SeoAuditDraftCompletionError) {
        return failureResponse(
          409,
          error.code,
          "The audit draft can no longer be saved.",
          correlationId,
        );
      }
      dependencies.reportUnexpectedError({
        correlationId,
        error: createSubmissionPhaseError(phase),
      });
      return failureResponse(
        500,
        "internal_error",
        "Unable to prepare the audit draft.",
        correlationId,
      );
    }
  };
}
