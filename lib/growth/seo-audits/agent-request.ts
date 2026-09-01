import {
  verifyAgentRequest,
  type VerifyAgentRequestInput,
} from "../integrations/agent-signature";

export const AGENT_KEY_ID_HEADER = "x-fss-key-id";
export const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
export const AGENT_SIGNATURE_HEADER = "x-fss-signature";

const MAX_AGENT_BODY_BYTES = 128 * 1024;

export type AgentRequestAuthentication = {
  agentKeyId: string;
  agentHmacSecret: string;
  now: () => Date;
  verifyRequest?: (
    input: VerifyAgentRequestInput,
  ) => ReturnType<typeof verifyAgentRequest>;
};

export class AgentRequestTooLargeError extends Error {}

export function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function failureResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): Response {
  return jsonResponse({ ok: false, code, message, correlationId }, status);
}

export async function readRawAgentBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_AGENT_BODY_BYTES
  ) {
    throw new AgentRequestTooLargeError();
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_AGENT_BODY_BYTES)
    throw new AgentRequestTooLargeError();
  return body;
}

export function isAuthenticatedAgentRequest(
  request: Request,
  rawBody: Uint8Array,
  authentication: AgentRequestAuthentication,
): boolean {
  const verify = authentication.verifyRequest ?? verifyAgentRequest;
  return verify({
    rawBody,
    keyId: request.headers.get(AGENT_KEY_ID_HEADER),
    timestamp: request.headers.get(AGENT_TIMESTAMP_HEADER),
    signature: request.headers.get(AGENT_SIGNATURE_HEADER),
    now: authentication.now(),
    configuredKeyId: authentication.agentKeyId,
    secret: authentication.agentHmacSecret,
  }).ok;
}

export function parseRawAgentJson(rawBody: Uint8Array): unknown {
  return JSON.parse(Buffer.from(rawBody).toString("utf8")) as unknown;
}
