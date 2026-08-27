import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import type { StoreProspectPreviewAssetInput } from "./service";
import {
  createProspectPreviewAssetPostHandler,
  type ProspectPreviewAssetRouteDependencies,
} from "./route-handler";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const TIMESTAMP = String(NOW.getTime() / 1000);
const KEY_ID = "weekday-agent-v1";
const SECRET = "test-agent-hmac-secret-with-32-characters";
const RUN_ID = "d0f57e79-413f-41dc-b15f-1b609fb29db2";
const PROSPECT_ID = "6322f2e9-a320-4e3c-8fbf-b2f137949e2c";
const EVIDENCE_ID = "bdac107a-2991-4c5e-a6ae-65933c2427cc";
const ASSET_ID = "c5b2e617-f78d-4d0d-9841-9c240c663be2";
const CORRELATION_ID = "corr-preview-asset-1";
const PNG_HEADER: Uint8Array<ArrayBuffer> = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type Harness = {
  handler: ReturnType<typeof createProspectPreviewAssetPostHandler>;
  references: unknown[];
  storedInputs: StoreProspectPreviewAssetInput[];
};

function createHarness(
  overrides: Partial<ProspectPreviewAssetRouteDependencies> = {},
): Harness {
  const references: unknown[] = [];
  const storedInputs: StoreProspectPreviewAssetInput[] = [];
  const dependencies: ProspectPreviewAssetRouteDependencies = {
    agentKeyId: KEY_ID,
    agentHmacSecret: SECRET,
    createCorrelationId: () => CORRELATION_ID,
    now: () => NOW,
    validateSourceEvidence: async (input) => {
      references.push(input);
      return true;
    },
    storeAsset: async (input) => {
      storedInputs.push(input);
      return {
        id: ASSET_ID,
        blobUrl: "https://blob.example.test/private-preview-asset.webp",
        contentType: "image/webp",
        byteSize: 1024,
        width: 960,
        height: 480,
        sha256: "a".repeat(64),
        reviewStatus: "source_verified",
      };
    },
    reportUnexpectedError: () => undefined,
    ...overrides,
  };

  return {
    handler: createProspectPreviewAssetPostHandler(dependencies),
    references,
    storedInputs,
  };
}

async function createMultipartBody(): Promise<{
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
}> {
  const form = new FormData();
  form.set("runId", RUN_ID);
  form.set("prospectId", PROSPECT_ID);
  form.set("evidenceId", EVIDENCE_ID);
  form.set("sourceUrl", "https://example.test/services");
  form.set("assetKind", "logo");
  form.set(
    "altText",
    "Example Services wordmark used on the business website header.",
  );
  form.set("file", new Blob([PNG_HEADER], { type: "image/png" }), "logo.png");

  const request = new Request("https://example.test/api/agent/prospect-preview-assets", {
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
): Request {
  const signature = createHmac("sha256", SECRET)
    .update(TIMESTAMP)
    .update(".")
    .update(bytes)
    .digest("hex");

  return new Request("https://example.test/api/agent/prospect-preview-assets", {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-fss-key-id": KEY_ID,
      "x-fss-timestamp": TIMESTAMP,
      "x-fss-signature": signature,
    },
    body: bytes,
  });
}

test("accepts a signed first-party asset and never exposes its private Blob URL", async () => {
  const harness = createHarness();
  const multipart = await createMultipartBody();

  const response = await harness.handler(
    createRequest(multipart.bytes, multipart.contentType),
  );

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    asset: { id: ASSET_ID, reviewStatus: "source_verified" },
  });
  assert.equal(harness.references.length, 1);
  assert.equal(harness.storedInputs[0]?.assetKind, "logo");
  assert.equal(harness.storedInputs[0]?.declaredContentType, "image/png");
});

test("rejects a signed upload whose source URL is not recorded first-party evidence", async () => {
  const harness = createHarness({ validateSourceEvidence: async () => false });
  const multipart = await createMultipartBody();

  const response = await harness.handler(
    createRequest(multipart.bytes, multipart.contentType),
  );

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "invalid_asset_reference",
    message: "The asset source is not recorded first-party evidence.",
    correlationId: CORRELATION_ID,
  });
  assert.deepEqual(harness.storedInputs, []);
});
