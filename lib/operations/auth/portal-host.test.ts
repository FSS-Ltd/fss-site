import assert from "node:assert/strict";
import test from "node:test";
import { portalRedirectForHost, portalRouteForHost } from "./portal-host";

test("maps the portal hostname root to the portal route", () => {
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/"),
    "/portal",
  );
  assert.equal(
    portalRouteForHost("PORTAL.FAITHFULSOFTWARE.DEV", "/", true),
    "/portal",
  );
});

test("maps nested prefix-free portal UI paths to their internal routes", () => {
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/projects/123", true),
    "/portal/projects/123",
  );
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/login", true),
    "/portal/login",
  );
});

test("does not rewrite portal APIs, webhooks, framework paths, or static assets", () => {
  for (const pathname of [
    "/api/portal/requests",
    "/webhooks/stripe",
    "/_next/static/chunks/app.js",
    "/icon.svg",
  ]) {
    assert.equal(
      portalRouteForHost("portal.faithfulsoftware.dev", pathname, true),
      null,
    );
  }
});

test("maps legacy visible portal paths to their prefix-free equivalents", () => {
  assert.equal(
    portalRedirectForHost("portal.faithfulsoftware.dev", "/portal", true),
    "/",
  );
  assert.equal(
    portalRedirectForHost("portal.faithfulsoftware.dev", "/portal/login", true),
    "/login",
  );
});

test("does not change non-portal hosts or explicit portal routes", () => {
  assert.equal(portalRouteForHost("faithfulsoftware.dev", "/", true), null);
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/portal/login", true),
    null,
  );
  assert.equal(
    portalRedirectForHost("faithfulsoftware.dev", "/portal/login", true),
    null,
  );
});

test("restores legacy portal paths when prefix-free routing is disabled", () => {
  assert.equal(
    portalRedirectForHost("portal.faithfulsoftware.dev", "/", false),
    "/portal",
  );
  assert.equal(
    portalRedirectForHost(
      "portal.faithfulsoftware.dev",
      "/projects/project-123",
      false,
    ),
    "/portal/projects/project-123",
  );
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/projects", false),
    null,
  );
  assert.equal(
    portalRedirectForHost(
      "portal.faithfulsoftware.dev",
      "/portal/projects",
      false,
    ),
    null,
  );
});
