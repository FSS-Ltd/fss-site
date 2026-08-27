import { z } from "zod";

import type {
  AgentSignatureResult,
  VerifyAgentRequestInput,
} from "../../integrations/agent-signature";
import { createApiErrorResponse, createJsonResponse } from "../../http/api-error";
import type { ProspectPreviewPrRunResult } from "./orchestrator";

const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";
const MAX_REQUEST_BYTES = 1024;
const externalRunIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
const requestSchema = z
  .object({ externalRunId: externalRunIdSchema })
  .strict();

class PayloadTooLargeError extends Error {}

export type ProspectPreviewPrRouteDependencies = {
  agentKeyId: string;
  agentHmacSecret: string;
  enabled: boolean;
  createCorrelationId: () => string;
  now: () => Date;
  verifyRequest: (input: VerifyAgentRequestInput) => AgentSignatureResult;
  isAllowedExternalRunId?: (externalRunId: string) => boolean;
  run: (externalRunId: string) => Promise<ProspectPreviewPrRunResult>;
  reportUnexpectedError: (input: {
    correlationId: string;
    error: unknown;
  }) => void;
};

async function readRawBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_REQUEST_BYTES
  ) {
    throw new PayloadTooLargeError();
  }

  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The byte limit remains authoritative when stream cleanup fails.
        }
        throw new PayloadTooLargeError();
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function parseRequest(rawBody: Uint8Array): string | null {
  try {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(rawBody),
    ) as unknown;
    const parsed = requestSchema.safeParse(value);
    return parsed.success ? parsed.data.externalRunId : null;
  } catch {
    return null;
  }
}

function toResponse(result: ProspectPreviewPrRunResult): object {
  return {
    externalRunId: result.externalRunId,
    status: result.status,
    generated: result.generated,
    unavailable: result.unavailable,
    pullRequestNumber: result.pullRequestNumber,
  };
}

export function createProspectPreviewPrPostHandler(
  dependencies: ProspectPreviewPrRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    const fail = (status: number, code: string, message: string) =>
      createApiErrorResponse(status, code, message, correlationId);

    let rawBody: Uint8Array;
    try {
      rawBody = await readRawBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return fail(413, "payload_too_large", "Preview generation request exceeds 1 KB.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to read the preview generation request.");
    }

    const signature = dependencies.verifyRequest({
      rawBody,
      keyId: request.headers.get(AGENT_KEY_ID_HEADER),
      timestamp: request.headers.get(AGENT_TIMESTAMP_HEADER),
      signature: request.headers.get(AGENT_SIGNATURE_HEADER),
      now: dependencies.now(),
      configuredKeyId: dependencies.agentKeyId,
      secret: dependencies.agentHmacSecret,
    });
    if (!signature.ok) {
      return fail(401, "unauthorized", "Request authentication failed.");
    }

    const externalRunId = parseRequest(rawBody);
    if (externalRunId === null) {
      return fail(422, "invalid_request", "Preview generation request validation failed.");
    }

    if (
      dependencies.isAllowedExternalRunId !== undefined &&
      !dependencies.isAllowedExternalRunId(externalRunId)
    ) {
      return fail(422, "invalid_request", "Preview generation request validation failed.");
    }

    if (!dependencies.enabled) {
      return createJsonResponse(
        {
          externalRunId,
          status: "disabled",
          generated: 0,
          unavailable: 0,
          pullRequestNumber: null,
        },
        200,
      );
    }

    try {
      return createJsonResponse(toResponse(await dependencies.run(externalRunId)), 200);
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to create the preview review pull request.");
    }
  };
}
