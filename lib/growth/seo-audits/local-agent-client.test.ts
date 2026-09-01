import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  SEO_AUDIT_AGENT_KEY_ID,
  postSignedSeoAuditRequest,
  createSignedSeoAuditRequestHeaders,
} from "./local-agent-client";

const secret = "test-agent-hmac-secret-with-32-characters";

test("signs the exact raw JSON bytes for an SEO audit request", () => {
  const rawBody = Buffer.from('{"limit":3}', "utf8");
  const headers = createSignedSeoAuditRequestHeaders({
    secret,
    rawBody,
    now: new Date("2026-09-01T12:46:10.000Z"),
  });

  assert.equal(headers.get("x-fss-key-id"), SEO_AUDIT_AGENT_KEY_ID);
  assert.equal(headers.get("x-fss-timestamp"), "1788266770");
  assert.equal(
    headers.get("x-fss-signature"),
    createHmac("sha256", secret)
      .update("1788266770")
      .update(".")
      .update(rawBody)
      .digest("hex"),
  );
});

test("posts the same bytes that were signed to the production audit endpoint", async () => {
  const rawBody = Buffer.from('{"limit":3}', "utf8");
  let observedUrl = "";
  let observedInit: RequestInit | undefined;

  await postSignedSeoAuditRequest({
    path: "/api/agent/seo-audits/claim",
    secret,
    rawBody,
    now: new Date("2026-09-01T12:46:10.000Z"),
    request: async (url, init) => {
      observedUrl = url.toString();
      observedInit = init;
      return new Response("{}", { status: 200 });
    },
  });

  assert.equal(
    observedUrl,
    "https://faithfulsoftware.dev/api/agent/seo-audits/claim",
  );
  assert.equal(observedInit?.method, "POST");
  assert.equal(
    await (observedInit?.body as Blob).text(),
    rawBody.toString("utf8"),
  );
  assert.equal(
    (observedInit?.headers as Headers).get("x-fss-key-id"),
    SEO_AUDIT_AGENT_KEY_ID,
  );
});
