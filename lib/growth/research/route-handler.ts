import type {
  AgentSignatureResult,
  VerifyAgentRequestInput,
} from "../integrations/agent-signature";
import { createApiErrorResponse, createJsonResponse } from "../http/api-error";
import { ResearchIngestionError } from "./ingest";
import { researchRunIngestionSchema } from "./ingestion-schema";
import { MAX_RESEARCH_BUNDLE_BYTES } from "./limits";
import type { ResearchRunIngestion, ResearchRunIngestionResult } from "./types";

const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";

class PayloadTooLargeError extends Error {}

export type ResearchRunRouteDependencies = {
  agentKeyId: string;
  agentHmacSecret: string;
  createCorrelationId: () => string;
  now: () => Date;
  verifyRequest: (input: VerifyAgentRequestInput) => AgentSignatureResult;
  ingest: (input: ResearchRunIngestion) => Promise<ResearchRunIngestionResult>;
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
    Number(declaredLength) > MAX_RESEARCH_BUNDLE_BYTES
  ) {
    throw new PayloadTooLargeError();
  }

  if (request.body === null) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_RESEARCH_BUNDLE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The byte limit remains authoritative if stream cleanup fails.
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

function parseJson(rawBody: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
  return JSON.parse(text) as unknown;
}

export function createResearchRunPostHandler(
  dependencies: ResearchRunRouteDependencies,
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
        return fail(413, "payload_too_large", "Research bundle exceeds 4 MB.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to read the research bundle.");
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

    let untrustedInput: unknown;
    try {
      untrustedInput = parseJson(rawBody);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }

    const parsed = researchRunIngestionSchema.safeParse(untrustedInput);
    if (!parsed.success) {
      return fail(422, "invalid_bundle", "Research bundle validation failed.");
    }

    try {
      const result = await dependencies.ingest(parsed.data);
      return createJsonResponse(result, 200);
    } catch (error) {
      if (error instanceof ResearchIngestionError) {
        return fail(422, error.code, "The research bundle cannot be ingested.");
      }

      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(
        500,
        "internal_error",
        "Unable to ingest the research bundle.",
      );
    }
  };
}
