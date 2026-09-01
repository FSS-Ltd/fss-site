import { createHmac } from "node:crypto";

export const SEO_AUDIT_AGENT_KEY_ID = "seo-audit-agent-v1";
export const SEO_AUDIT_AGENT_ORIGIN = "https://faithfulsoftware.dev";

export type SignedSeoAuditRequestInput = {
  secret: string;
  rawBody: Uint8Array;
  now?: Date;
};

function unixTimestamp(now: Date): string {
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("SEO audit request time is invalid.");
  }
  return String(Math.floor(now.getTime() / 1_000));
}

export function createSignedSeoAuditRequestHeaders({
  secret,
  rawBody,
  now = new Date(),
}: SignedSeoAuditRequestInput): Headers {
  if (secret.replace(/\s/g, "").length < 32) {
    throw new TypeError("SEO audit signing secret is invalid.");
  }

  const timestamp = unixTimestamp(now);
  const signature = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");

  return new Headers({
    "content-type": "application/json",
    "x-fss-key-id": SEO_AUDIT_AGENT_KEY_ID,
    "x-fss-timestamp": timestamp,
    "x-fss-signature": signature,
  });
}

export async function postSignedSeoAuditRequest(input: {
  path:
    | "/api/agent/seo-audits/claim"
    | "/api/agent/seo-audits"
    | "/api/agent/seo-audits/release"
    | "/api/agent/seo-audits/regenerate-reports";
  secret: string;
  rawBody: Uint8Array;
  now?: Date;
  request?: (url: URL, init: RequestInit) => Promise<Response>;
}): Promise<Response> {
  const request = input.request ?? ((url, init) => fetch(url, init));
  const body = new ArrayBuffer(input.rawBody.byteLength);
  new Uint8Array(body).set(input.rawBody);
  return request(new URL(input.path, SEO_AUDIT_AGENT_ORIGIN), {
    method: "POST",
    headers: createSignedSeoAuditRequestHeaders(input),
    body: new Blob([body]),
  });
}
