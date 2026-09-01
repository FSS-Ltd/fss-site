import { createHash } from "node:crypto";

import { z } from "zod";

import {
  verifyAgentRequest,
  type VerifyAgentRequestInput,
} from "../integrations/agent-signature";

import { renderSeoAuditPdf } from "./pdf";
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

const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";
const MAX_AGENT_BODY_BYTES = 128 * 1024;

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
  verifyRequest?: (
    input: VerifyAgentRequestInput,
  ) => ReturnType<typeof verifyAgentRequest>;
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

class RequestTooLargeError extends Error {}

function response(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function failure(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): Response {
  return response({ ok: false, code, message, correlationId }, status);
}

async function readRawBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_AGENT_BODY_BYTES
  ) {
    throw new RequestTooLargeError();
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_AGENT_BODY_BYTES) throw new RequestTooLargeError();
  return body;
}

function authenticate(
  request: Request,
  rawBody: Uint8Array,
  dependencies: SeoAuditAgentRouteDependencies,
): boolean {
  const verify = dependencies.verifyRequest ?? verifyAgentRequest;
  return verify({
    rawBody,
    keyId: request.headers.get(AGENT_KEY_ID_HEADER),
    timestamp: request.headers.get(AGENT_TIMESTAMP_HEADER),
    signature: request.headers.get(AGENT_SIGNATURE_HEADER),
    now: dependencies.now(),
    configuredKeyId: dependencies.agentKeyId,
    secret: dependencies.agentHmacSecret,
  }).ok;
}

function parseJson(rawBody: Uint8Array): unknown {
  return JSON.parse(Buffer.from(rawBody).toString("utf8")) as unknown;
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
      rawBody = await readRawBody(request);
    } catch (error) {
      if (error instanceof RequestTooLargeError) {
        return failure(
          413,
          "payload_too_large",
          "Request body exceeds 128 KB.",
          correlationId,
        );
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return failure(
        400,
        "invalid_body",
        "Unable to read the request body.",
        correlationId,
      );
    }
    if (!authenticate(request, rawBody, dependencies)) {
      return failure(
        401,
        "unauthorized",
        "Request authentication failed.",
        correlationId,
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = parseJson(rawBody);
    } catch {
      return failure(
        400,
        "invalid_json",
        "Request body must be valid JSON.",
        correlationId,
      );
    }
    const parsed = claimRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return failure(
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
      return response(
        {
          ok: true,
          correlationId,
          candidates: candidates.map(candidateResponse),
        },
        200,
      );
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return failure(
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
      rawBody = await readRawBody(request);
    } catch (error) {
      if (error instanceof RequestTooLargeError) {
        return failure(
          413,
          "payload_too_large",
          "Request body exceeds 128 KB.",
          correlationId,
        );
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return failure(
        400,
        "invalid_body",
        "Unable to read the request body.",
        correlationId,
      );
    }
    if (!authenticate(request, rawBody, dependencies)) {
      return failure(
        401,
        "unauthorized",
        "Request authentication failed.",
        correlationId,
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = parseJson(rawBody);
    } catch {
      return failure(
        400,
        "invalid_json",
        "Request body must be valid JSON.",
        correlationId,
      );
    }
    const parsed = seoAuditSubmissionSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return failure(
        422,
        "invalid_fields",
        "Audit submission fields are invalid.",
        correlationId,
      );
    }

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
        return failure(
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
      const storedReport = await dependencies.blobStorage.putReport({
        pathname: `growth-seo-audits/${context.auditId}/audit-${sha256}.pdf`,
        bytes: pdf,
      });
      try {
        const outputSnapshot = createStoredSeoAuditDraft({
          submission: parsed.data,
          reportUrl: storedReport.url,
          reportSha256: sha256,
        });
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

      return response(
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
        return failure(
          409,
          error.code,
          "The audit draft can no longer be saved.",
          correlationId,
        );
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return failure(
        500,
        "internal_error",
        "Unable to prepare the audit draft.",
        correlationId,
      );
    }
  };
}
