import assert from "node:assert/strict";
import test from "node:test";

import {
  dynamic,
  generateMetadata,
} from "./[publicId]/page";
import {
  redirectProductionProspectPreviewPage,
} from "@/components/prospect-previews/production-prospect-preview-page";

const PUBLIC_ID = "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm";

async function assertRedirectsTo(
  promise: Promise<unknown>,
  destination: string,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== "string") return false;
    assert.match(digest, new RegExp(`NEXT_REDIRECT;replace;${destination};`));
    return true;
  });
}

test("marks published opaque preview pages as dynamic and noindex", async () => {
  const metadata = await generateMetadata();

  assert.equal(dynamic, "force-dynamic");
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("redirects opaque published preview URLs to their slug route", async () => {
  await assertRedirectsTo(
    redirectProductionProspectPreviewPage(
      PUBLIC_ID,
      async () => "example-heating",
    ),
    "/preview/example-heating",
  );
});

test("does not render database-only preview IDs", async () => {
  await assert.rejects(
    redirectProductionProspectPreviewPage(
      PUBLIC_ID,
      async () => null,
    ),
  );
});
