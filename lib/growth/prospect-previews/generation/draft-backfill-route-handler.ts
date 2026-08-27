import type {
  AgentSignatureResult,
  VerifyAgentRequestInput,
} from "../../integrations/agent-signature";
import { createApiErrorResponse, createJsonResponse } from "../../http/api-error";
import type { BackfillProspectPreviewsResult } from "../backfill";

const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";
const MAX_REQUEST_BYTES = 1;

class PayloadTooLargeError extends Error {}

export type CurrentTenDraftBackfillRouteDependencies = {
  agentKeyId: string;
  agentHmacSecret: string;
  enabled: boolean;
  createCorrelationId: () => string;
  now: () => Date;
  verifyRequest: (input: VerifyAgentRequestInput) => AgentSignatureResult;
  run: () => Promise<BackfillProspectPreviewsResult>;
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

export function createCurrentTenDraftBackfillPostHandler(
  dependencies: CurrentTenDraftBackfillRouteDependencies,
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
        return fail(413, "payload_too_large", "Draft backfill request exceeds 1 byte.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to read the draft backfill request.");
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

    if (rawBody.byteLength !== 0) {
      return fail(422, "invalid_request", "Draft backfill request must be empty.");
    }

    if (!dependencies.enabled) {
      return createJsonResponse(
        { status: "disabled", scanned: 0, created: 0, skipped: 0, invalid: 0 },
        200,
      );
    }

    try {
      return createJsonResponse(
        { status: "backfilled", ...(await dependencies.run()) },
        200,
      );
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to backfill prospect preview drafts.");
    }
  };
}
