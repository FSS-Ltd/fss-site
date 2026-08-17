import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgentSignatureResult,
  VerifyAgentRequestInput,
} from "../../../../lib/growth/integrations/agent-signature";
import { ResearchIngestionError } from "../../../../lib/growth/research/ingest";
import { createResearchRunPostHandler } from "../../../../lib/growth/research/route-handler";
import { MAX_RESEARCH_BUNDLE_BYTES } from "../../../../lib/growth/research/limits";
import type {
  ResearchRunIngestion,
  ResearchRunIngestionResult,
} from "../../../../lib/growth/research/types";

const CORRELATION_ID = "corr-research-1";
const NOW = new Date("2026-08-17T06:00:00.000Z");
const SUCCESS_RESULT: ResearchRunIngestionResult = {
  ok: true,
  runId: "a1d186ca-7c08-4ee0-86a4-d8ef2b2882f1",
  accepted: 0,
  duplicates: 0,
  rejected: 1,
  acceptedProspects: [],
};
const SIGNED_HEADERS = {
  "x-fss-key-id": "weekday-agent-v1",
  "x-fss-timestamp": "1786946400",
  "x-fss-signature": "a".repeat(64),
};

function validPayload(): ResearchRunIngestion {
  return {
    schemaVersion: "1.0",
    externalRunId: "weekday-2026-08-17",
    runDate: "2026-08-17",
    timezone: "Europe/London",
    promptVersion: "weekday-research-v1",
    prospects: [],
    rejections: [
      {
        candidateName: "Outside Area Ltd",
        reasonCode: "outside_kent",
      },
    ],
  };
}

type HarnessOverrides = {
  signatureResult?: AgentSignatureResult;
  ingest?: (input: ResearchRunIngestion) => Promise<ResearchRunIngestionResult>;
};

function createHarness(overrides: HarnessOverrides = {}) {
  const verificationInputs: VerifyAgentRequestInput[] = [];
  const ingestedInputs: ResearchRunIngestion[] = [];
  const reportedErrors: Array<{ correlationId: string; error: unknown }> = [];

  const handler = createResearchRunPostHandler({
    agentKeyId: "weekday-agent-v1",
    agentHmacSecret: "test-secret",
    createCorrelationId: () => CORRELATION_ID,
    now: () => NOW,
    verifyRequest: (input) => {
      verificationInputs.push(input);
      return overrides.signatureResult ?? { ok: true };
    },
    ingest: async (input) => {
      ingestedInputs.push(input);
      return overrides.ingest?.(input) ?? SUCCESS_RESULT;
    },
    reportUnexpectedError: (input) => reportedErrors.push(input),
  });

  return { handler, verificationInputs, ingestedInputs, reportedErrors };
}

function createRequest(
  body: string,
  headers: Record<string, string> = SIGNED_HEADERS,
): Request {
  return new Request("https://faithfulsoftware.dev/api/agent/research-runs", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

function createByteRequest(body: Uint8Array<ArrayBuffer>): Request {
  return new Request("https://faithfulsoftware.dev/api/agent/research-runs", {
    method: "POST",
    headers: { "content-type": "application/json", ...SIGNED_HEADERS },
    body,
  });
}

async function assertApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
): Promise<void> {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), {
    ok: false,
    code,
    message,
    correlationId: CORRELATION_ID,
  });
}

test("rejects a missing signature before parsing or ingestion", async () => {
  const harness = createHarness({
    signatureResult: { ok: false, code: "missing" },
  });
  const response = await harness.handler(createRequest("not-json", {}));

  await assertApiError(
    response,
    401,
    "unauthorized",
    "Request authentication failed.",
  );
  assert.equal(harness.verificationInputs[0]?.keyId, null);
  assert.deepEqual(harness.ingestedInputs, []);
});

test("rejects an invalid signature before ingestion", async () => {
  const harness = createHarness({
    signatureResult: { ok: false, code: "invalid" },
  });
  const response = await harness.handler(
    createRequest(JSON.stringify(validPayload())),
  );

  await assertApiError(
    response,
    401,
    "unauthorized",
    "Request authentication failed.",
  );
  assert.deepEqual(harness.ingestedInputs, []);
});

test("verifies the exact raw body before parsing it", async () => {
  const harness = createHarness();
  const body = `  ${JSON.stringify(validPayload())}\n`;

  const response = await harness.handler(createRequest(body));

  assert.equal(response.status, 200);
  assert.deepEqual(
    [...(harness.verificationInputs[0]?.rawBody ?? [])],
    [...new TextEncoder().encode(body)],
  );
  assert.equal(harness.verificationInputs[0]?.timestamp, "1786946400");
  assert.equal(harness.verificationInputs[0]?.now, NOW);
});

test("rejects a declared oversized bundle before signature verification", async () => {
  const harness = createHarness();
  const response = await harness.handler(
    createRequest("{}", {
      ...SIGNED_HEADERS,
      "content-length": String(MAX_RESEARCH_BUNDLE_BYTES + 1),
    }),
  );

  await assertApiError(
    response,
    413,
    "payload_too_large",
    "Research bundle exceeds 4 MB.",
  );
  assert.deepEqual(harness.verificationInputs, []);
  assert.deepEqual(harness.ingestedInputs, []);
});

test("stops streaming a bundle once the byte limit is exceeded", async () => {
  const harness = createHarness();
  const response = await harness.handler(
    createByteRequest(new Uint8Array(MAX_RESEARCH_BUNDLE_BYTES + 1)),
  );

  await assertApiError(
    response,
    413,
    "payload_too_large",
    "Research bundle exceeds 4 MB.",
  );
  assert.deepEqual(harness.verificationInputs, []);
  assert.deepEqual(harness.ingestedInputs, []);
});

test("preserves the 413 response when stream cancellation fails", async () => {
  const harness = createHarness();
  let cancellationAttempted = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_RESEARCH_BUNDLE_BYTES + 1));
    },
    cancel() {
      cancellationAttempted = true;
      return Promise.reject(new Error("cancel failed"));
    },
  });
  const requestInit: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { "content-type": "application/json", ...SIGNED_HEADERS },
    body,
    duplex: "half",
  };

  const response = await harness.handler(
    new Request(
      "https://faithfulsoftware.dev/api/agent/research-runs",
      requestInit,
    ),
  );

  await assertApiError(
    response,
    413,
    "payload_too_large",
    "Research bundle exceeds 4 MB.",
  );
  assert.equal(cancellationAttempted, true);
  assert.deepEqual(harness.reportedErrors, []);
});

test("returns a safe error for invalid JSON", async () => {
  const harness = createHarness();
  const response = await harness.handler(createRequest("{broken"));

  await assertApiError(
    response,
    400,
    "invalid_json",
    "Request body must be valid JSON.",
  );
  assert.deepEqual(harness.ingestedInputs, []);
});

test("rejects malformed UTF-8 instead of mutating signed input", async () => {
  const harness = createHarness();
  const body = JSON.stringify(validPayload());
  const bytes = new TextEncoder().encode(body);
  const candidateNameOffset = body.indexOf("Outside Area Ltd");
  bytes[candidateNameOffset] = 0xff;

  const response = await harness.handler(createByteRequest(bytes));

  await assertApiError(
    response,
    400,
    "invalid_json",
    "Request body must be valid JSON.",
  );
  assert.deepEqual(harness.ingestedInputs, []);
});

test("returns a safe error for an invalid research bundle", async () => {
  const harness = createHarness();
  const response = await harness.handler(
    createRequest(JSON.stringify({ ...validPayload(), timezone: "UTC" })),
  );

  await assertApiError(
    response,
    422,
    "invalid_bundle",
    "Research bundle validation failed.",
  );
  assert.deepEqual(harness.ingestedInputs, []);
});

test("returns the ingestion result for an accepted bundle", async () => {
  const harness = createHarness();
  const input = validPayload();
  const response = await harness.handler(createRequest(JSON.stringify(input)));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), SUCCESS_RESULT);
  assert.deepEqual(harness.ingestedInputs, [input]);
});

test("returns the same result for an idempotent retry", async () => {
  const harness = createHarness();
  const body = JSON.stringify(validPayload());

  const first = await harness.handler(createRequest(body));
  const retry = await harness.handler(createRequest(body));

  assert.deepEqual(await first.json(), SUCCESS_RESULT);
  assert.deepEqual(await retry.json(), SUCCESS_RESULT);
  assert.equal(harness.ingestedInputs.length, 2);
});

test("returns a safe domain error for a suppressed candidate", async () => {
  const harness = createHarness({
    ingest: async () => {
      throw new ResearchIngestionError(
        "suppressed_contact",
        "Sensitive contact detail.",
      );
    },
  });
  const response = await harness.handler(
    createRequest(JSON.stringify(validPayload())),
  );

  const responseText = await response.text();
  assert.equal(response.status, 422);
  assert.deepEqual(JSON.parse(responseText), {
    ok: false,
    code: "suppressed_contact",
    message: "The research bundle cannot be ingested.",
    correlationId: CORRELATION_ID,
  });
  assert.doesNotMatch(responseText, /sensitive/i);
  assert.deepEqual(harness.reportedErrors, []);
});

test("reports unexpected failures without leaking details", async () => {
  const failure = new Error("database connection detail");
  const harness = createHarness({
    ingest: async () => {
      throw failure;
    },
  });
  const response = await harness.handler(
    createRequest(JSON.stringify(validPayload())),
  );

  const responseText = await response.text();
  assert.equal(response.status, 500);
  assert.deepEqual(JSON.parse(responseText), {
    ok: false,
    code: "internal_error",
    message: "Unable to ingest the research bundle.",
    correlationId: CORRELATION_ID,
  });
  assert.deepEqual(harness.reportedErrors, [
    { correlationId: CORRELATION_ID, error: failure },
  ]);
  assert.doesNotMatch(responseText, /database/i);
});
