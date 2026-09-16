import assert from "node:assert/strict";
import test from "node:test";
import { portalRedirectForHost, portalRouteForHost } from "./portal-host";

test("maps the portal hostname root to the portal route", () => {
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/"),
    "/portal",
  );
  assert.equal(
    portalRouteForHost("PORTAL.FAITHFULSOFTWARE.DEV", "/"),
    "/portal",
  );
});

test("maps nested prefix-free portal UI paths to their internal routes", () => {
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/projects/123"),
    "/portal/projects/123",
  );
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/login"),
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
      portalRouteForHost("portal.faithfulsoftware.dev", pathname),
      null,
    );
  }
});

test("maps legacy visible portal paths to their prefix-free equivalents", () => {
  assert.equal(
    portalRedirectForHost("portal.faithfulsoftware.dev", "/portal"),
    "/",
  );
  assert.equal(
    portalRedirectForHost("portal.faithfulsoftware.dev", "/portal/login"),
    "/login",
  );
});

test("does not change non-portal hosts or explicit portal routes", () => {
  assert.equal(portalRouteForHost("faithfulsoftware.dev", "/"), null);
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/portal/login"),
    null,
  );
  assert.equal(
    portalRedirectForHost("faithfulsoftware.dev", "/portal/login"),
    null,
  );
});
