import { z } from "zod";

import type {
  AgentSignatureResult,
  VerifyAgentRequestInput,
} from "../../integrations/agent-signature";
import { createApiErrorResponse, createJsonResponse } from "../../http/api-error";
import { PreviewRefreshError } from "./service";

const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";
const MAX_REFRESH_BYTES = 512 * 1024;

const refreshRequestSchema = z
  .object({ updates: z.array(z.unknown()).min(1).max(20) })
  .strict();

class PayloadTooLargeError extends Error {}

export type ProspectPreviewRefreshRouteDependencies = {
  agentKeyId: string;
  agentHmacSecret: string;
  createCorrelationId: () => string;
  now: () => Date;
  verifyRequest: (input: VerifyAgentRequestInput) => AgentSignatureResult;
  refresh: (
    updates: unknown,
  ) => Promise<readonly { prospectId: string; status: "refreshed" }[]>;
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
    Number(declaredLength) > MAX_REFRESH_BYTES
  ) {
    throw new PayloadTooLargeError();
  }
  if (request.body === null) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new Uint8Array(value);
      total += chunk.byteLength;
      if (total > MAX_REFRESH_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function parseJson(rawBody: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)) as unknown;
}

export function createProspectPreviewRefreshPostHandler(
  dependencies: ProspectPreviewRefreshRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    const fail = (status: number, code: string, message: string) =>
      createApiErrorResponse(status, code, message, correlationId);

    let rawBody: Uint8Array<ArrayBuffer>;
    try {
      rawBody = await readRawBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return fail(413, "payload_too_large", "Refresh bundle exceeds 512 KB.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to read the refresh bundle.");
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

    let parsedBody: unknown;
    try {
      parsedBody = parseJson(rawBody);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    const parsed = refreshRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return fail(422, "invalid_bundle", "Refresh bundle validation failed.");
    }

    try {
      const refreshed = await dependencies.refresh(parsed.data.updates);
      return createJsonResponse({ ok: true, refreshed: refreshed.length }, 200);
    } catch (error) {
      if (error instanceof PreviewRefreshError) {
        return fail(422, error.code, "Preview refresh could not be applied.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to refresh previews.");
    }
  };
}
