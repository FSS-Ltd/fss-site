import assert from "node:assert/strict";
import test from "node:test";

import { isPreviewDeployment, resolveSiteUrl } from "./site-url";

test("resolves an explicitly configured canonical URL", () => {
  assert.equal(
    resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://faithfulsoftware.dev/" }),
    "https://faithfulsoftware.dev",
  );
});

test("resolves the Vercel deployment URL when no canonical URL is configured", () => {
  assert.equal(
    resolveSiteUrl({ VERCEL_URL: "fss-site-preview.vercel.app" }),
    "https://fss-site-preview.vercel.app",
  );
});

test("recognises Vercel preview deployments", () => {
  assert.equal(isPreviewDeployment({ VERCEL_ENV: "preview" }), true);
  assert.equal(isPreviewDeployment({ VERCEL_ENV: "production" }), false);
});
