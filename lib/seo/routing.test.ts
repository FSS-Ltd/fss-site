import assert from "node:assert/strict";
import test from "node:test";

import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";
import { resolvePortalOrigin } from "../operations/auth/configuration";
import { prefixFreePortalEnabled } from "../operations/auth/release-flags";

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
  assert.deepEqual(
    (await nextConfig.redirects?.())?.filter(
      (redirect) => redirect.source === "/:path*",
    ),
    [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.faithfulsoftware.dev" }],
        destination: "https://faithfulsoftware.dev/:path*",
        permanent: true,
      },
    ],
  );
});

test("legacy resources use one 308 hop to completed landing and thank-you routes", async () => {
  for (const [oldSlug, newSlug] of [
    ["sdk-integration-readiness-kit", "software-project-readiness-kit"],
    ["technical-content-conversion-playbook", "software-investment-framework"],
  ]) {
    for (const host of ["faithfulsoftware.dev", "www.faithfulsoftware.dev"]) {
      for (const suffix of ["", "/thank-you"]) {
        const response = await unstable_getResponseFromNextConfig({
          url: `https://${host}/resources/${oldSlug}${suffix}?source=email`,
          nextConfig,
        });
        assert.equal(response.status, 308);
        const location = response.headers.get("location");
        assert.ok(location);
        assert.equal(
          new URL(location, `https://${host}`).toString(),
          `https://faithfulsoftware.dev/resources/${newSlug}${suffix}?source=email`,
        );
      }
    }
  }
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

test("already-sent agreement links redirect from public hosts to the portal", async () => {
  const prefix = prefixFreePortalEnabled() ? "" : "/portal";
  for (const host of ["faithfulsoftware.dev", "www.faithfulsoftware.dev"]) {
    for (const path of [
      "/agreements/offers/offer-id",
      "/agreements/approval-id/sign",
    ]) {
      const search = "?organisationId=organisation-id";
      const response = await unstable_getResponseFromNextConfig({
        url: `https://${host}/portal${path}${search}`,
        nextConfig,
      });
      assert.equal(response.status, 307);
      assert.equal(
        response.headers.get("location"),
        `${resolvePortalOrigin()}${prefix}${path}${search}`,
      );
    }
  }
});

test("legacy agreement link redirect is scoped to public hosts and client pages", async () => {
  for (const url of [
    `${resolvePortalOrigin()}/portal/agreements/offers/offer-id`,
    "https://fss-git-preview.vercel.app/portal/agreements/offers/offer-id",
    "https://faithfulsoftware.dev/api/portal/organisations/organisation-id/commercial-offers",
    "https://faithfulsoftware.dev/portal/admin/clients/organisation-id/agreements",
    "https://faithfulsoftware.dev/portal/login",
  ]) {
    const response = await unstable_getResponseFromNextConfig({
      url,
      nextConfig,
    });
    assert.equal(response.headers.get("location"), null, url);
  }
});
