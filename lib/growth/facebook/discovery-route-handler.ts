import { createHash } from "node:crypto";
import type {
  AgentSignatureResult,
  VerifyAgentRequestInput,
} from "../integrations/agent-signature";
import {
  PayloadTooLargeError,
  readRawBody,
} from "../integrations/read-raw-body";
import { createApiErrorResponse, createJsonResponse } from "../http/api-error";
import {
  facebookDiscoveryBatchSchema,
  type FacebookDiscoveryBatch,
} from "./contracts";
import { FacebookError } from "./service";

const MAX_BYTES = 256 * 1024;
type Principal = { keyId: string; bodySha256: string };
type Dependencies = {
  agentKeyId: string;
  agentHmacSecret: string;
  now: () => Date;
  createCorrelationId: () => string;
  verifyRequest: (input: VerifyAgentRequestInput) => AgentSignatureResult;
  ingest: (
    batch: FacebookDiscoveryBatch,
    principal: Principal,
    correlationId: string,
  ) => Promise<{ count: number; alreadyExisted: boolean }>;
  reportUnexpectedError: (input: {
    correlationId: string;
    error: unknown;
  }) => void;
};
export function createFacebookDiscoveryHandler(
  dependencies: Dependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    const fail = (status: number, code: string, message: string) =>
      createApiErrorResponse(status, code, message, correlationId);
    let rawBody: Uint8Array;
    try {
      rawBody = await readRawBody(request, MAX_BYTES);
    } catch (error) {
      if (error instanceof PayloadTooLargeError)
        return fail(
          413,
          "payload_too_large",
          "Discovery bundle exceeds the size limit.",
        );
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to read discovery bundle.");
    }
    const verified = dependencies.verifyRequest({
      rawBody,
      keyId: request.headers.get("x-fss-key-id"),
      timestamp: request.headers.get("x-fss-timestamp"),
      signature: request.headers.get("x-fss-signature"),
      now: dependencies.now(),
      configuredKeyId: dependencies.agentKeyId,
      secret: dependencies.agentHmacSecret,
    });
    if (!verified.ok)
      return fail(401, "unauthorized", "Request authentication failed.");
    let input: unknown;
    try {
      input = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(rawBody),
      );
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    const parsed = facebookDiscoveryBatchSchema.safeParse(input);
    if (!parsed.success)
      return fail(422, "invalid_bundle", "Discovery bundle validation failed.");
    try {
      return createJsonResponse(
        await dependencies.ingest(
          parsed.data,
          {
            keyId: dependencies.agentKeyId,
            bodySha256: createHash("sha256").update(rawBody).digest("hex"),
          },
          correlationId,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof FacebookError)
        return fail(
          error.code === "request_conflict" ? 409 : 422,
          error.code,
          "Discovery bundle cannot be ingested.",
        );
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to ingest discovery bundle.");
    }
  };
}
