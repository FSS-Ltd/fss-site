import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  EmailAssetValidationError,
  type StoreEmailAssetInput,
  type StoredEmailAsset,
} from "./service";
import {
  createEmailAssetPostHandler,
  type EmailAssetRouteDependencies,
} from "./route-handler";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const TIMESTAMP = String(NOW.getTime() / 1000);
const KEY_ID = "weekday-agent-v1";
const SECRET = "test-agent-hmac-secret-with-32-characters";
const RUN_ID = "d0f57e79-413f-41dc-b15f-1b609fb29db2";
const PROSPECT_ID = "6322f2e9-a320-4e3c-8fbf-b2f137949e2c";
const ASSET_ID = "c5b2e617-f78d-4d0d-9841-9c240c663be2";
const CORRELATION_ID = "corr-email-asset-1";
const PNG_HEADER: Uint8Array<ArrayBuffer> = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const storedAsset: StoredEmailAsset & { internalPrompt: string } = {
  id: ASSET_ID,
  blobUrl: `https://blob.example.test/growth-email-assets/${ASSET_ID}.webp`,
  contentType: "image/webp",
  byteSize: 1024,
  width: 1200,
  height: 630,
  sha256: "a".repeat(64),
  reviewStatus: "pending",
  internalPrompt: "must never reach the response",
};

type Harness = {
  handler: ReturnType<typeof createEmailAssetPostHandler>;
  associationChecks: Array<{ runId: string; prospectId: string }>;
  storedInputs: StoreEmailAssetInput[];
  reportedErrors: unknown[];
};

function createHarness(
  overrides: Partial<EmailAssetRouteDependencies> = {},
): Harness {
  const associationChecks: Array<{ runId: string; prospectId: string }> = [];
  const storedInputs: StoreEmailAssetInput[] = [];
  const reportedErrors: unknown[] = [];
  const dependencies: EmailAssetRouteDependencies = {
    agentKeyId: KEY_ID,
    agentHmacSecret: SECRET,
    createCorrelationId: () => CORRELATION_ID,
    now: () => NOW,
    prospectBelongsToRun: async (input) => {
      associationChecks.push(input);
      return true;
    },
    storeAsset: async (input) => {
      storedInputs.push(input);
      return storedAsset;
    },
    reportUnexpectedError: (error) => {
      reportedErrors.push(error);
    },
    ...overrides,
  };

  return {
    handler: createEmailAssetPostHandler(dependencies),
    associationChecks,
    storedInputs,
    reportedErrors,
  };
}

type MultipartFields = {
  runId?: string;
  prospectId?: string;
  altText?: string;
  promptSummary?: string;
  assetKind?: string;
  includeFile?: boolean;
  duplicateField?:
    | "runId"
    | "prospectId"
    | "altText"
    | "promptSummary"
    | "assetKind"
    | "file";
  includeUnknownField?: boolean;
};

async function createMultipartBody(
  fields: MultipartFields = {},
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  const values = {
    runId: RUN_ID,
    prospectId: PROSPECT_ID,
    altText:
      "Concept showing a customer enquiry moving into an organised service workflow.",
    promptSummary: "A generic workflow concept with no personal data.",
    assetKind: "cold_first_email",
    includeFile: true,
    ...fields,
  };
  const form = new FormData();
  for (const name of [
    "runId",
    "prospectId",
    "altText",
    "promptSummary",
    "assetKind",
  ] as const) {
    const value = values[name];
    if (value !== undefined) {
      form.set(name, value);
    }
  }
  if (values.includeFile) {
    form.set(
      "file",
      new Blob([PNG_HEADER], { type: "image/png" }),
      "asset.png",
    );
  }
  if (values.duplicateField === "file") {
    form.append(
      "file",
      new Blob([PNG_HEADER], { type: "image/png" }),
      "duplicate.png",
    );
  } else if (values.duplicateField !== undefined) {
    form.append(values.duplicateField, "duplicate-value");
  }
  if (values.includeUnknownField) {
    form.set("trackingToken", "unexpected");
  }

  const request = new Request("https://example.test/api/agent/email-assets", {
    method: "POST",
    body: form,
  });
  return {
    bytes: new Uint8Array(await request.arrayBuffer()),
    contentType: request.headers.get("content-type") ?? "",
  };
}

function createRequest(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  options: { validSignature?: boolean; contentLength?: string } = {},
): Request {
  const signature = createHmac("sha256", SECRET)
    .update(TIMESTAMP)
    .update(".")
    .update(bytes)
    .digest("hex");
  const headers = new Headers({
    "content-type": contentType,
    "x-fss-key-id": KEY_ID,
    "x-fss-timestamp": TIMESTAMP,
    "x-fss-signature":
      options.validSignature === false ? "0".repeat(64) : signature,
  });
  if (options.contentLength !== undefined) {
    headers.set("content-length", options.contentLength);
  }

  return new Request("https://example.test/api/agent/email-assets", {
    method: "POST",
    headers,
    body: bytes,
  });
}

async function assertApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
): Promise<void> {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), {
    ok: false,
    code,
    message,
    correlationId: CORRELATION_ID,
  });
}

test("stores a valid signed multipart asset and returns only safe metadata", async () => {
  const harness = createHarness();
  const multipart = await createMultipartBody();

  const response = await harness.handler(
    createRequest(multipart.bytes, multipart.contentType),
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    asset: {
      id: ASSET_ID,
      blobUrl: `https://blob.example.test/growth-email-assets/${ASSET_ID}.webp`,
      contentType: "image/webp",
      byteSize: 1024,
      width: 1200,
      height: 630,
      sha256: "a".repeat(64),
      reviewStatus: "pending",
    },
  });
  assert.deepEqual(harness.associationChecks, [
    { runId: RUN_ID, prospectId: PROSPECT_ID },
  ]);
  assert.equal(harness.storedInputs.length, 1);
  assert.deepEqual(harness.storedInputs[0]?.bytes, PNG_HEADER);
  assert.deepEqual(
    { ...harness.storedInputs[0], bytes: undefined },
    {
      runId: RUN_ID,
      prospectId: PROSPECT_ID,
      altText:
        "Concept showing a customer enquiry moving into an organised service workflow.",
      promptSummary: "A generic workflow concept with no personal data.",
      assetKind: "cold_first_email",
      declaredContentType: "image/png",
      bytes: undefined,
    },
  );
});

test("rejects an invalid signature before parsing multipart bytes", async () => {
  const harness = createHarness();
  const malformedBody = Uint8Array.from([1, 2, 3, 4]);

  const response = await harness.handler(
    createRequest(malformedBody, "multipart/form-data; boundary=not-present", {
      validSignature: false,
    }),
  );

  await assertApiError(
    response,
    401,
    "unauthorized",
    "Request authentication failed.",
  );
  assert.deepEqual(harness.associationChecks, []);
  assert.deepEqual(harness.storedInputs, []);
});

test("rejects a body above 512 KB before authentication or parsing", async () => {
  const harness = createHarness();
  const oversizedBody = new Uint8Array(512 * 1024 + 1);

  const response = await harness.handler(
    createRequest(oversizedBody, "application/octet-stream"),
  );

  await assertApiError(
    response,
    413,
    "payload_too_large",
    "Upload exceeds 512 KB.",
  );
  assert.deepEqual(harness.associationChecks, []);
  assert.deepEqual(harness.storedInputs, []);
});

test("rejects a declared content length above 512 KB without reading the body", async () => {
  const harness = createHarness();

  const response = await harness.handler(
    createRequest(Uint8Array.from([1]), "application/octet-stream", {
      contentLength: String(512 * 1024 + 1),
    }),
  );

  await assertApiError(
    response,
    413,
    "payload_too_large",
    "Upload exceeds 512 KB.",
  );
  assert.deepEqual(harness.associationChecks, []);
});

test("requires every multipart field before checking database ownership", async (t) => {
  for (const missing of [
    "runId",
    "prospectId",
    "altText",
    "promptSummary",
    "assetKind",
  ] as const) {
    await t.test(missing, async () => {
      const harness = createHarness();
      const multipart = await createMultipartBody({ [missing]: undefined });
      const response = await harness.handler(
        createRequest(multipart.bytes, multipart.contentType),
      );

      await assertApiError(
        response,
        400,
        "invalid_fields",
        "Invalid upload fields.",
      );
      assert.deepEqual(harness.associationChecks, []);
      assert.deepEqual(harness.storedInputs, []);
    });
  }

  await t.test("file", async () => {
    const harness = createHarness();
    const multipart = await createMultipartBody({ includeFile: false });
    const response = await harness.handler(
      createRequest(multipart.bytes, multipart.contentType),
    );

    await assertApiError(
      response,
      400,
      "invalid_fields",
      "Invalid upload fields.",
    );
    assert.deepEqual(harness.associationChecks, []);
    assert.deepEqual(harness.storedInputs, []);
  });
});

test("rejects malformed identifiers and unsupported asset kinds", async (t) => {
  for (const fields of [
    { runId: "not-a-uuid" },
    { prospectId: "not-a-uuid" },
    { assetKind: "tracking_pixel" },
  ]) {
    await t.test(JSON.stringify(fields), async () => {
      const harness = createHarness();
      const multipart = await createMultipartBody(fields);
      const response = await harness.handler(
        createRequest(multipart.bytes, multipart.contentType),
      );

      await assertApiError(
        response,
        400,
        "invalid_fields",
        "Invalid upload fields.",
      );
      assert.deepEqual(harness.associationChecks, []);
      assert.deepEqual(harness.storedInputs, []);
    });
  }
});

test("rejects duplicate or unknown multipart fields", async (t) => {
  for (const duplicateField of [
    "runId",
    "prospectId",
    "altText",
    "promptSummary",
    "assetKind",
    "file",
  ] as const) {
    await t.test(`duplicate ${duplicateField}`, async () => {
      const harness = createHarness();
      const multipart = await createMultipartBody({ duplicateField });
      const response = await harness.handler(
        createRequest(multipart.bytes, multipart.contentType),
      );

      await assertApiError(
        response,
        400,
        "invalid_fields",
        "Invalid upload fields.",
      );
      assert.deepEqual(harness.associationChecks, []);
      assert.deepEqual(harness.storedInputs, []);
    });
  }

  await t.test("unknown field", async () => {
    const harness = createHarness();
    const multipart = await createMultipartBody({ includeUnknownField: true });
    const response = await harness.handler(
      createRequest(multipart.bytes, multipart.contentType),
    );

    await assertApiError(
      response,
      400,
      "invalid_fields",
      "Invalid upload fields.",
    );
    assert.deepEqual(harness.associationChecks, []);
    assert.deepEqual(harness.storedInputs, []);
  });
});

test("rejects a prospect that does not belong to the referenced run", async () => {
  const harness = createHarness({
    prospectBelongsToRun: async () => false,
  });
  const multipart = await createMultipartBody();

  const response = await harness.handler(
    createRequest(multipart.bytes, multipart.contentType),
  );

  await assertApiError(
    response,
    422,
    "invalid_asset_reference",
    "The prospect does not belong to the referenced research run.",
  );
  assert.deepEqual(harness.storedInputs, []);
});

test("returns a stable validation response without leaking processing details", async () => {
  const harness = createHarness({
    storeAsset: async () => {
      throw new EmailAssetValidationError(
        "invalid_image",
        "Internal image decoder detail.",
      );
    },
  });
  const multipart = await createMultipartBody();

  const response = await harness.handler(
    createRequest(multipart.bytes, multipart.contentType),
  );

  assert.equal(response.status, 422);
  const responseText = await response.text();
  assert.deepEqual(JSON.parse(responseText), {
    ok: false,
    code: "invalid_image",
    message: "The uploaded asset is invalid.",
    correlationId: CORRELATION_ID,
  });
  assert.doesNotMatch(responseText, /decoder/i);
});

test("reports an unexpected failure and returns a generic server error", async () => {
  const failure = new Error("database connection detail");
  const harness = createHarness({
    storeAsset: async () => {
      throw failure;
    },
  });
  const multipart = await createMultipartBody();

  const response = await harness.handler(
    createRequest(multipart.bytes, multipart.contentType),
  );

  assert.equal(response.status, 500);
  const responseText = await response.text();
  assert.deepEqual(JSON.parse(responseText), {
    ok: false,
    code: "internal_error",
    message: "Unable to store the asset.",
    correlationId: CORRELATION_ID,
  });
  assert.deepEqual(harness.reportedErrors, [
    { correlationId: CORRELATION_ID, error: failure },
  ]);
  assert.doesNotMatch(responseText, /database/i);
});
