import type {
  AgentSignatureResult,
  VerifyAgentRequestInput,
} from "./agent-signature";
import { createApiErrorResponse, createJsonResponse } from "../http/api-error";

const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";

class PayloadTooLargeError extends Error {}

export type AgentEmptyPostHandlerDependencies<ResponseBody extends object> = {
  agentKeyId: string;
  agentHmacSecret: string;
  enabled: boolean;
  createCorrelationId: () => string;
  now: () => Date;
  verifyRequest: (input: VerifyAgentRequestInput) => AgentSignatureResult;
  maxRequestBytes: number;
  oversizedRequestMessage: string;
  nonEmptyRequestMessage: string;
  readFailureMessage: string;
  operationFailureMessage: string;
  disabledResponse: ResponseBody;
  run: () => Promise<ResponseBody>;
  reportUnexpectedError: (input: {
    correlationId: string;
    error: unknown;
  }) => void;
};

async function readRawBody(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maximumBytes
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
      if (totalBytes > maximumBytes) {
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

export function createAgentEmptyPostHandler<ResponseBody extends object>(
  dependencies: AgentEmptyPostHandlerDependencies<ResponseBody>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    const fail = (status: number, code: string, message: string) =>
      createApiErrorResponse(status, code, message, correlationId);

    let rawBody: Uint8Array;
    try {
      rawBody = await readRawBody(request, dependencies.maxRequestBytes);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return fail(413, "payload_too_large", dependencies.oversizedRequestMessage);
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", dependencies.readFailureMessage);
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
      return fail(422, "invalid_request", dependencies.nonEmptyRequestMessage);
    }

    if (!dependencies.enabled) {
      return createJsonResponse(dependencies.disabledResponse, 200);
    }

    try {
      return createJsonResponse(await dependencies.run(), 200);
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", dependencies.operationFailureMessage);
    }
  };
}
