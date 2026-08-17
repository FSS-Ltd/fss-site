import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  EMAIL_ASSET_FALLBACKS,
  resolveEmailAsset,
  type EmailAssetFallbackKey,
} from "./fallbacks";

const EXPECTED_KEYS: EmailAssetFallbackKey[] = [
  "home-property",
  "automotive",
  "professional-services",
  "estate-agency",
  "hospitality",
];

test("defines one accessible fallback for every approved sector group", () => {
  assert.deepEqual(Object.keys(EMAIL_ASSET_FALLBACKS), EXPECTED_KEYS);

  for (const fallback of Object.values(EMAIL_ASSET_FALLBACKS)) {
    assert.match(
      fallback.pathname,
      /^\/growth\/email\/fallbacks\/[a-z-]+\.webp$/,
    );
    assert.ok(fallback.altText.trim().length >= 20);
    assert.match(fallback.sha256, /^[0-9a-f]{64}$/);
  }
});

test("ships optimized 1200 by 630 WebP files with locked checksums", async () => {
  for (const fallback of Object.values(EMAIL_ASSET_FALLBACKS)) {
    const file = await readFile(
      path.join(process.cwd(), "public", fallback.pathname),
    );
    const metadata = await sharp(file).metadata();
    const checksum = createHash("sha256").update(file).digest("hex");

    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
    assert.ok(file.byteLength <= 180 * 1024);
    assert.equal(checksum, fallback.sha256);
  }
});

test("resolves a stored asset ID before considering a fallback", () => {
  assert.deepEqual(
    resolveEmailAsset({
      assetId: "c5b2e617-f78d-4d0d-9841-9c240c663be2",
      fallbackAssetKey: "hospitality",
    }),
    {
      kind: "stored",
      assetId: "c5b2e617-f78d-4d0d-9841-9c240c663be2",
    },
  );
});

test("resolves the configured fallback when no custom asset exists", () => {
  assert.deepEqual(
    resolveEmailAsset({
      assetId: null,
      fallbackAssetKey: "home-property",
    }),
    {
      kind: "fallback",
      asset: EMAIL_ASSET_FALLBACKS["home-property"],
    },
  );
});
