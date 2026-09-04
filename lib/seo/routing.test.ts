import assert from "node:assert/strict";
import test from "node:test";

import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

test("private trees and thank-you pages receive robots response headers", async () => {
  const headers = await nextConfig.headers?.();
  for (const source of [
    "/growth/:path*",
    "/preview/:path*",
    "/resources/:slug/thank-you/:path*",
  ]) {
    assert.ok(
      headers
        ?.find((entry) => entry.source === source)
        ?.headers.some(
          (header) =>
            header.key === "X-Robots-Tag" && header.value.includes("noindex"),
        ),
    );
  }
  assert.equal(
    headers?.find(
      (entry) => entry.source === "/resources/:slug/thank-you/:path*",
    )?.headers[0].value,
    "noindex, follow",
  );
});

test("only the production www host redirects permanently to the canonical host", async () => {
  assert.deepEqual(await nextConfig.redirects?.(), [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.faithfulsoftware.dev" }],
      destination: "https://faithfulsoftware.dev/:path*",
      permanent: true,
    },
  ]);
});

test("routing matches private roots and descendants while leaving public routes indexable", async () => {
  for (const path of [
    "/growth",
    "/growth/login",
    "/growth/prospects/123",
    "/preview",
    "/preview/p/123",
    "/resources/example/thank-you",
    "/resources/example/thank-you/",
  ]) {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://faithfulsoftware.dev${path}`,
      nextConfig,
    });
    assert.match(response.headers.get("X-Robots-Tag") ?? "", /noindex/);
  }
  const response = await unstable_getResponseFromNextConfig({
    url: "https://faithfulsoftware.dev/services",
    nextConfig,
  });
  assert.equal(response.headers.get("X-Robots-Tag"), null);
});

test("www redirect preserves nested paths and query parameters without redirecting preview hosts", async () => {
  const response = await unstable_getResponseFromNextConfig({
    url: "https://www.faithfulsoftware.dev/resources/kit?source=email",
    nextConfig,
  });
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://faithfulsoftware.dev/resources/kit?source=email",
  );
  const preview = await unstable_getResponseFromNextConfig({
    url: "https://fss-git-preview.vercel.app/services",
    nextConfig,
  });
  assert.equal(preview.headers.get("location"), null);
});
