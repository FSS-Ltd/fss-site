import assert from "node:assert/strict";
import test from "node:test";

import {
  isPreviewDeployment,
  resolveAllowedSiteOrigins,
  resolveSiteUrl,
} from "./site-url";

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

test("allows the exact Vercel preview origin alongside the canonical site", () => {
  assert.deepEqual(
    resolveAllowedSiteOrigins({
      NEXT_PUBLIC_SITE_URL: "https://faithfulsoftware.dev",
      VERCEL_ENV: "preview",
      VERCEL_URL: "fss-site-git-portal-invite.vercel.app",
      VERCEL_BRANCH_URL: "fss-site-git-feature.vercel.app",
    }),
    [
      "https://faithfulsoftware.dev",
      "https://fss-site-git-portal-invite.vercel.app",
      "https://fss-site-git-feature.vercel.app",
    ],
  );
});

test("does not register a preview origin for production deployments", () => {
  assert.deepEqual(
    resolveAllowedSiteOrigins({
      NEXT_PUBLIC_SITE_URL: "https://faithfulsoftware.dev",
      VERCEL_ENV: "production",
      VERCEL_URL: "fss-site-preview.vercel.app",
    }),
    ["https://faithfulsoftware.dev"],
  );
});

test("uses only the canonical origin outside Vercel preview deployments", () => {
  assert.deepEqual(
    resolveAllowedSiteOrigins({
      NEXT_PUBLIC_SITE_URL: "https://faithfulsoftware.dev",
      NODE_ENV: "development",
      VERCEL_URL: "fss-site-preview.vercel.app",
    }),
    ["https://faithfulsoftware.dev"],
  );
});
